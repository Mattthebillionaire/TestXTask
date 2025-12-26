import type { Timestamps } from './common.types';

export interface TrendingTopic {
  id: string;
  topic: string;
  keyword: string;
  tweetCount: number;
  woeid: number;
  fetchedAt: Date;
}

export interface ViralPost {
  id: string;
  tweetId: string;
  author: string;
  authorId: string;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
  structureType: TweetStructureType;
  fetchedAt: Date;
}

export type TweetStructureType =
  | 'hook_story'
  | 'list_format'
  | 'question_answer'
  | 'controversial_take'
  | 'thread_starter'
  | 'call_to_action'
  | 'educational'
  | 'humor'
  | 'unknown';

export interface TweetPattern {
  id: string;
  type: TweetStructureType;
  hookTemplate: string;
  ctaTemplate: string | null;
  avgLength: number;
  emojiDensity: number;
  exampleId: string;
}

export interface DraftPost extends Timestamps {
  id: string;
  content: string;
  basedOnPatternId: string;
  basedOnTrendId: string;
  status: 'draft' | 'approved' | 'rejected' | 'posted';
}

export interface QueueItem {
  id: string;
  draftId: string;
  scheduledAt: Date;
  status: 'pending' | 'posting' | 'posted' | 'failed';
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: Date;
}

export interface PostedTweet {
  id: string;
  tweetId: string;
  content: string;
  postedAt: Date;
  engagement24h?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface TwitterUser {
  id: string;
  username: string;
  name: string;
  followersCount: number;
  verified: boolean;
}

export interface TwitterSearchParams {
  query: string;
  maxResults?: number;
  startTime?: Date;
  endTime?: Date;
}
