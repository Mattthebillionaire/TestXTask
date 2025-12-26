import { postTweet } from './twitter.service';
import { getDraftsFromSheet, updateDraftStatus } from './generation.service';
import { appendSheetRows, getSheetRows, updateSheetRowById } from './sheets.service';
import { generateId } from '@/lib/utils/id';
import { RATE_LIMITS, RETRY_CONFIG } from '@/constants/rate-limits.constants';
import { SHEET_NAMES, type QueueSheetRow, type PostedSheetRow } from '@/types/sheets.types';
import type { QueueItem, PostedTweet, DraftPost } from '@/types/twitter.types';

export interface AddToQueueConfig {
  draftId: string;
  scheduledAt?: Date;
}

export interface ProcessQueueResult {
  processed: number;
  posted: number;
  failed: number;
  skipped: number;
  rateLimited: boolean;
  errors: string[];
}

export interface PublishResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  queueItemId?: string;
}

export interface RateLimitStatus {
  canPost: boolean;
  tweetsIn24h: number;
  tweetsIn15min: number;
  remainingIn24h: number;
  remainingIn15min: number;
  nextAvailableAt?: Date;
}

function queueItemToSheetRow(item: QueueItem): string[] {
  return [
    item.id,
    item.draftId,
    item.scheduledAt.toISOString(),
    item.status,
    String(item.retryCount),
    item.lastError || '',
    item.lastAttemptAt?.toISOString() || '',
  ];
}

function postedTweetToSheetRow(tweet: PostedTweet): string[] {
  return [
    tweet.id,
    tweet.tweetId,
    tweet.content,
    tweet.postedAt.toISOString(),
    tweet.engagement24h ? JSON.stringify(tweet.engagement24h) : '',
  ];
}

export async function getQueueFromSheet(status?: QueueItem['status']): Promise<QueueItem[]> {
  const rows = await getSheetRows<QueueSheetRow>(SHEET_NAMES.QUEUE);

  let items = rows.map(row => ({
    id: row.id,
    draftId: row.draft_id,
    scheduledAt: new Date(row.scheduled_at),
    status: row.status as QueueItem['status'],
    retryCount: parseInt(row.retry_count, 10) || 0,
    lastError: row.last_error || undefined,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at) : undefined,
  }));

  if (status) {
    items = items.filter(item => item.status === status);
  }

  items.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return items;
}

export async function getPostedTweetsFromSheet(): Promise<PostedTweet[]> {
  const rows = await getSheetRows<PostedSheetRow>(SHEET_NAMES.POSTED);

  const tweets = rows.map(row => {
    let engagement24h: PostedTweet['engagement24h'];
    if (row.engagement_24h) {
      try {
        engagement24h = JSON.parse(row.engagement_24h);
      } catch {
        engagement24h = undefined;
      }
    }

    return {
      id: row.id,
      tweetId: row.tweet_id,
      content: row.content,
      postedAt: new Date(row.posted_at),
      engagement24h,
    };
  });

  tweets.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

  return tweets;
}

export async function checkRateLimits(): Promise<RateLimitStatus> {
  const [postedTweets, queueItems] = await Promise.all([
    getPostedTweetsFromSheet(),
    getQueueFromSheet(),
  ]);
  const now = new Date();

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const postedIn24h = postedTweets.filter(t => t.postedAt >= twentyFourHoursAgo);
  const postedIn15min = postedTweets.filter(t => t.postedAt >= fifteenMinutesAgo);

  const failedAttemptsIn24h = queueItems.filter(
    q => q.lastAttemptAt && q.lastAttemptAt >= twentyFourHoursAgo && q.status !== 'posted'
  );
  const failedAttemptsIn15min = queueItems.filter(
    q => q.lastAttemptAt && q.lastAttemptAt >= fifteenMinutesAgo && q.status !== 'posted'
  );

  const tweetsIn24h = postedIn24h.length + failedAttemptsIn24h.length;
  const tweetsIn15min = postedIn15min.length + failedAttemptsIn15min.length;

  const remainingIn24h = RATE_LIMITS.TWEETS_PER_24H - tweetsIn24h;
  const remainingIn15min = RATE_LIMITS.TWEETS_PER_15MIN - tweetsIn15min;

  const canPost = remainingIn24h > 0 && remainingIn15min > 0;

  let nextAvailableAt: Date | undefined;
  if (!canPost) {
    const allAttemptsIn15min = [
      ...postedIn15min.map(t => t.postedAt),
      ...failedAttemptsIn15min.map(q => q.lastAttemptAt!),
    ].sort((a, b) => a.getTime() - b.getTime());

    const allAttemptsIn24h = [
      ...postedIn24h.map(t => t.postedAt),
      ...failedAttemptsIn24h.map(q => q.lastAttemptAt!),
    ].sort((a, b) => a.getTime() - b.getTime());

    if (remainingIn15min <= 0 && allAttemptsIn15min.length > 0) {
      nextAvailableAt = new Date(allAttemptsIn15min[0].getTime() + 15 * 60 * 1000);
    } else if (remainingIn24h <= 0 && allAttemptsIn24h.length > 0) {
      nextAvailableAt = new Date(allAttemptsIn24h[0].getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return {
    canPost,
    tweetsIn24h,
    tweetsIn15min,
    remainingIn24h: Math.max(0, remainingIn24h),
    remainingIn15min: Math.max(0, remainingIn15min),
    nextAvailableAt,
  };
}

export async function addToQueue(config: AddToQueueConfig): Promise<QueueItem> {
  const drafts = await getDraftsFromSheet();
  const draft = drafts.find(d => d.id === config.draftId);

  if (!draft) {
    throw new Error(`Draft not found: ${config.draftId}`);
  }

  if (draft.status !== 'approved') {
    throw new Error(`Draft must be approved before queuing. Current status: ${draft.status}`);
  }

  const existingQueue = await getQueueFromSheet();
  const alreadyQueued = existingQueue.find(
    item => item.draftId === config.draftId && ['pending', 'posting'].includes(item.status)
  );

  if (alreadyQueued) {
    throw new Error(`Draft is already in queue: ${alreadyQueued.id}`);
  }

  const queueItem: QueueItem = {
    id: `queue_${generateId()}`,
    draftId: config.draftId,
    scheduledAt: config.scheduledAt || new Date(),
    status: 'pending',
    retryCount: 0,
  };

  await appendSheetRows(SHEET_NAMES.QUEUE, [queueItemToSheetRow(queueItem)]);

  return queueItem;
}

export interface UpdateQueueItemOptions {
  status?: QueueItem['status'];
  lastError?: string;
  scheduledAt?: Date;
  lastAttemptAt?: Date;
  incrementRetryCount?: boolean;
}

export async function updateQueueItem(
  queueItemId: string,
  options: UpdateQueueItemOptions
): Promise<boolean> {
  const updates: Record<string, string> = {};

  if (options.status !== undefined) {
    updates.status = options.status;
  }

  if (options.lastError !== undefined) {
    updates.last_error = options.lastError;
  }

  if (options.scheduledAt !== undefined) {
    updates.scheduled_at = options.scheduledAt.toISOString();
  }

  if (options.lastAttemptAt !== undefined) {
    updates.last_attempt_at = options.lastAttemptAt.toISOString();
  }

  if (options.incrementRetryCount) {
    const queue = await getQueueFromSheet();
    const item = queue.find(q => q.id === queueItemId);
    if (item) {
      updates.retry_count = String(item.retryCount + 1);
    }
  }

  return updateSheetRowById(SHEET_NAMES.QUEUE, queueItemId, updates);
}

export async function updateQueueItemStatus(
  queueItemId: string,
  status: QueueItem['status'],
  lastError?: string
): Promise<boolean> {
  return updateQueueItem(queueItemId, {
    status,
    lastError,
    incrementRetryCount: status === 'failed',
  });
}

export async function savePostedTweet(tweet: PostedTweet): Promise<void> {
  await appendSheetRows(SHEET_NAMES.POSTED, [postedTweetToSheetRow(tweet)]);
}

export async function publishDraft(draftId: string): Promise<PublishResult> {
  const drafts = await getDraftsFromSheet();
  const draft = drafts.find(d => d.id === draftId);

  if (!draft) {
    return { success: false, error: `Draft not found: ${draftId}` };
  }

  if (draft.status === 'posted') {
    return { success: false, error: 'Draft has already been posted' };
  }

  const rateLimits = await checkRateLimits();
  if (!rateLimits.canPost) {
    return {
      success: false,
      error: `Rate limit exceeded. ${rateLimits.remainingIn24h} remaining in 24h, ${rateLimits.remainingIn15min} remaining in 15min`,
    };
  }

  try {
    const result = await postTweet(draft.content);

    const postedTweet: PostedTweet = {
      id: `posted_${generateId()}`,
      tweetId: result.tweetId,
      content: draft.content,
      postedAt: new Date(),
    };

    await savePostedTweet(postedTweet);
    await updateDraftStatus(draftId, 'posted');

    return {
      success: true,
      tweetId: result.tweetId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function processQueueItem(queueItem: QueueItem): Promise<PublishResult> {
  await updateQueueItem(queueItem.id, { status: 'posting' });

  const drafts = await getDraftsFromSheet();
  const draft = drafts.find(d => d.id === queueItem.draftId);

  if (!draft) {
    await updateQueueItem(queueItem.id, {
      status: 'failed',
      lastError: `Draft not found: ${queueItem.draftId}`,
    });
    return {
      success: false,
      error: `Draft not found: ${queueItem.draftId}`,
      queueItemId: queueItem.id,
    };
  }

  if (draft.status === 'posted') {
    await updateQueueItem(queueItem.id, { status: 'posted' });
    return {
      success: true,
      queueItemId: queueItem.id,
    };
  }

  const attemptTime = new Date();
  await updateQueueItem(queueItem.id, { lastAttemptAt: attemptTime });

  try {
    const result = await postTweet(draft.content);

    const postedTweet: PostedTweet = {
      id: `posted_${generateId()}`,
      tweetId: result.tweetId,
      content: draft.content,
      postedAt: new Date(),
    };

    await savePostedTweet(postedTweet);
    await updateDraftStatus(queueItem.draftId, 'posted');
    await updateQueueItem(queueItem.id, { status: 'posted' });

    return {
      success: true,
      tweetId: result.tweetId,
      queueItemId: queueItem.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const newRetryCount = queueItem.retryCount + 1;
    const shouldRetry = newRetryCount <= RETRY_CONFIG.maxRetries;

    if (shouldRetry) {
      const backoffIndex = Math.min(queueItem.retryCount, RETRY_CONFIG.backoffMs.length - 1);
      const backoffMs = RETRY_CONFIG.backoffMs[backoffIndex];
      const nextScheduledAt = new Date(Date.now() + backoffMs);

      await updateQueueItem(queueItem.id, {
        status: 'pending',
        lastError: errorMessage,
        scheduledAt: nextScheduledAt,
        incrementRetryCount: true,
      });
    } else {
      await updateQueueItem(queueItem.id, {
        status: 'failed',
        lastError: errorMessage,
        incrementRetryCount: true,
      });
    }

    return {
      success: false,
      error: errorMessage,
      queueItemId: queueItem.id,
    };
  }
}

export async function processQueue(): Promise<ProcessQueueResult> {
  const result: ProcessQueueResult = {
    processed: 0,
    posted: 0,
    failed: 0,
    skipped: 0,
    rateLimited: false,
    errors: [],
  };

  const rateLimits = await checkRateLimits();

  if (!rateLimits.canPost) {
    result.rateLimited = true;
    result.errors.push(
      `Rate limit active: ${rateLimits.remainingIn24h} remaining in 24h, ${rateLimits.remainingIn15min} remaining in 15min`
    );
    return result;
  }

  const pendingItems = await getQueueFromSheet('pending');
  const now = new Date();

  const dueItems = pendingItems.filter(item => item.scheduledAt <= now);

  if (dueItems.length === 0) {
    return result;
  }

  let availableSlots = Math.min(rateLimits.remainingIn15min, rateLimits.remainingIn24h);

  for (let i = 0; i < dueItems.length; i++) {
    const item = dueItems[i];

    if (availableSlots <= 0) {
      result.rateLimited = true;
      result.skipped = dueItems.length - i;
      result.errors.push('Rate limit reached during processing');
      break;
    }

    availableSlots--;

    const publishResult = await processQueueItem(item);
    result.processed++;

    if (publishResult.success) {
      result.posted++;
    } else {
      if (item.retryCount >= RETRY_CONFIG.maxRetries) {
        result.failed++;
      }
      result.errors.push(`Queue item ${item.id}: ${publishResult.error}`);
    }

    if (result.processed < dueItems.length && availableSlots > 0) {
      const backoffMs = RETRY_CONFIG.backoffMs[0];
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  return result;
}

export async function scheduleNextAvailable(draftId: string): Promise<QueueItem> {
  const rateLimits = await checkRateLimits();

  let scheduledAt: Date;

  if (rateLimits.canPost) {
    scheduledAt = new Date();
  } else if (rateLimits.nextAvailableAt) {
    scheduledAt = rateLimits.nextAvailableAt;
  } else {
    scheduledAt = new Date(Date.now() + 15 * 60 * 1000);
  }

  return addToQueue({ draftId, scheduledAt });
}

export async function getQueueStats(): Promise<{
  pending: number;
  posting: number;
  posted: number;
  failed: number;
  totalPostedToday: number;
  rateLimits: RateLimitStatus;
}> {
  const [queue, rateLimits] = await Promise.all([
    getQueueFromSheet(),
    checkRateLimits(),
  ]);

  return {
    pending: queue.filter(q => q.status === 'pending').length,
    posting: queue.filter(q => q.status === 'posting').length,
    posted: queue.filter(q => q.status === 'posted').length,
    failed: queue.filter(q => q.status === 'failed').length,
    totalPostedToday: rateLimits.tweetsIn24h,
    rateLimits,
  };
}
