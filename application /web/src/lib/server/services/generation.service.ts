import {
  generateMultipleTweets,
  generateFromInspiration,
  type GenerationPrompt,
  type GeneratedContent,
  type InspirationPost,
} from './openai.service';
import {
  getPatternsFromSheet,
  getPatternsByType,
  getTrendsFromSheet,
  getViralPostsFromSheet,
} from './discovery.service';
import { appendSheetRows, getSheetRows, updateSheetRowById } from './sheets.service';
import { generateId } from '@/lib/utils/id';
import { CONTENT_LIMITS } from '@/constants/rate-limits.constants';
import { SHEET_NAMES, type DraftsSheetRow } from '@/types/sheets.types';
import type { TweetPattern, TweetStructureType, DraftPost, TrendingTopic, ViralPost } from '@/types/twitter.types';

export interface GenerationConfig {
  topic?: string;
  trendId?: string;
  patternId?: string;
  structureType?: TweetStructureType;
  variantCount?: number;
  tone?: string;
  emojiDensity?: 'none' | 'low' | 'medium' | 'high';
  autoApprove?: boolean;
}

export interface GenerationResult {
  drafts: DraftPost[];
  filtered: {
    tooLong: number;
    duplicate: number;
    lowQuality: number;
    brandUnsafe: number;
  };
  pattern: TweetPattern | null;
  trend: TrendingTopic | null;
}

export interface QualityCheckResult {
  passed: boolean;
  reason?: string;
  category?: 'length' | 'duplicate' | 'quality' | 'brand_safety';
}

export interface DuplicateCheckContext {
  existingDrafts: DraftPost[];
  viralPosts: ViralPost[];
  newlyGeneratedContents: string[];
}

const BANNED_PHRASES = [
  'click here',
  'buy now',
  'limited time',
  'act now',
  'free money',
  'get rich',
  'make money fast',
  'dm for',
  'link in bio',
  '100% guaranteed',
  'you won\'t believe',
  'doctors hate',
  'one weird trick',
];

const LOW_QUALITY_PATTERNS = [
  /^(hey|hi|hello)\s+(guys|everyone|folks)/i,
  /\b(amazing|awesome|incredible|unbelievable)\b.*\b(amazing|awesome|incredible|unbelievable)\b/i,
  /!{3,}/,
  /\.{4,}/,
  /^RT\s+/i,
  /follow\s+me\s+for\s+follow/i,
  /f4f|l4l|s4s/i,
];

export function checkContentLength(content: string): QualityCheckResult {
  if (content.length > CONTENT_LIMITS.MAX_TWEET_LENGTH) {
    return {
      passed: false,
      reason: `Content exceeds ${CONTENT_LIMITS.MAX_TWEET_LENGTH} characters (${content.length})`,
      category: 'length',
    };
  }

  if (content.length < 20) {
    return {
      passed: false,
      reason: 'Content is too short (minimum 20 characters)',
      category: 'length',
    };
  }

  return { passed: true };
}

export function checkBrandSafety(content: string): QualityCheckResult {
  const lowerContent = content.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lowerContent.includes(phrase.toLowerCase())) {
      return {
        passed: false,
        reason: `Contains banned phrase: "${phrase}"`,
        category: 'brand_safety',
      };
    }
  }

  return { passed: true };
}

export function checkContentQuality(content: string): QualityCheckResult {
  for (const pattern of LOW_QUALITY_PATTERNS) {
    if (pattern.test(content)) {
      return {
        passed: false,
        reason: 'Content matches low-quality pattern',
        category: 'quality',
      };
    }
  }

  const words = content.split(/\s+/);
  if (words.length < 3) {
    return {
      passed: false,
      reason: 'Content has too few words',
      category: 'quality',
    };
  }

  return { passed: true };
}

export async function prepareDuplicateCheckContext(): Promise<DuplicateCheckContext> {
  const [existingDrafts, viralPosts] = await Promise.all([
    getDraftsFromSheet(),
    getViralPostsFromSheet({ recencyHours: 168 }),
  ]);

  return {
    existingDrafts,
    viralPosts: viralPosts.slice(0, 100),
    newlyGeneratedContents: [],
  };
}

export function checkDuplicateWithContext(
  content: string,
  context: DuplicateCheckContext
): QualityCheckResult {
  const normalizedContent = content.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const newContent of context.newlyGeneratedContents) {
    const normalizedNew = newContent.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalizedContent === normalizedNew) {
      return {
        passed: false,
        reason: 'Duplicate of another generated variant',
        category: 'duplicate',
      };
    }
    const similarity = calculateSimilarity(normalizedContent, normalizedNew);
    if (similarity > 0.85) {
      return {
        passed: false,
        reason: `Too similar to another generated variant (${Math.round(similarity * 100)}% match)`,
        category: 'duplicate',
      };
    }
  }

  for (const draft of context.existingDrafts) {
    const normalizedDraft = draft.content.toLowerCase().replace(/\s+/g, ' ').trim();

    if (normalizedContent === normalizedDraft) {
      return {
        passed: false,
        reason: 'Exact duplicate of existing draft',
        category: 'duplicate',
      };
    }

    const similarity = calculateSimilarity(normalizedContent, normalizedDraft);
    if (similarity > 0.85) {
      return {
        passed: false,
        reason: `Too similar to existing draft (${Math.round(similarity * 100)}% match)`,
        category: 'duplicate',
      };
    }
  }

  for (const post of context.viralPosts) {
    const normalizedPost = post.content.toLowerCase().replace(/\s+/g, ' ').trim();
    const similarity = calculateSimilarity(normalizedContent, normalizedPost);

    if (similarity > 0.7) {
      return {
        passed: false,
        reason: 'Too similar to existing viral post (potential plagiarism)',
        category: 'duplicate',
      };
    }
  }

  return { passed: true };
}

export async function checkDuplicate(content: string): Promise<QualityCheckResult> {
  const context = await prepareDuplicateCheckContext();
  return checkDuplicateWithContext(content, context);
}

function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

export function runQualityChecksWithContext(
  content: string,
  context: DuplicateCheckContext
): QualityCheckResult {
  const lengthCheck = checkContentLength(content);
  if (!lengthCheck.passed) return lengthCheck;

  const brandCheck = checkBrandSafety(content);
  if (!brandCheck.passed) return brandCheck;

  const qualityCheck = checkContentQuality(content);
  if (!qualityCheck.passed) return qualityCheck;

  const duplicateCheck = checkDuplicateWithContext(content, context);
  if (!duplicateCheck.passed) return duplicateCheck;

  return { passed: true };
}

export async function runQualityChecks(content: string): Promise<QualityCheckResult> {
  const context = await prepareDuplicateCheckContext();
  return runQualityChecksWithContext(content, context);
}

async function selectPattern(config: GenerationConfig): Promise<TweetPattern | null> {
  if (config.patternId) {
    const patterns = await getPatternsFromSheet();
    return patterns.find(p => p.id === config.patternId) || null;
  }

  if (config.structureType) {
    const patterns = await getPatternsByType(config.structureType);
    if (patterns.length > 0) {
      return patterns[Math.floor(Math.random() * patterns.length)];
    }
  }

  const patterns = await getPatternsFromSheet();
  if (patterns.length > 0) {
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  return null;
}

async function selectTrend(config: GenerationConfig): Promise<TrendingTopic | null> {
  if (config.topic) {
    return null;
  }

  if (config.trendId) {
    const trends = await getTrendsFromSheet(false);
    return trends.find(t => t.id === config.trendId) || null;
  }

  const trends = await getTrendsFromSheet(true);
  if (trends.length > 0) {
    return trends[Math.floor(Math.random() * trends.length)];
  }

  return null;
}

function draftToSheetRow(draft: DraftPost): string[] {
  return [
    draft.id,
    draft.content,
    draft.basedOnPatternId,
    draft.basedOnTrendId,
    draft.status,
    draft.createdAt.toISOString(),
    draft.updatedAt.toISOString(),
  ];
}

export async function saveDraftToSheet(draft: DraftPost): Promise<void> {
  const rows = [draftToSheetRow(draft)];
  await appendSheetRows(SHEET_NAMES.DRAFTS, rows);
}

export async function saveDraftsToSheet(drafts: DraftPost[]): Promise<number> {
  if (drafts.length === 0) return 0;

  const rows = drafts.map(draftToSheetRow);
  await appendSheetRows(SHEET_NAMES.DRAFTS, rows);
  return drafts.length;
}

export async function getDraftsFromSheet(status?: DraftPost['status']): Promise<DraftPost[]> {
  const rows = await getSheetRows<DraftsSheetRow>(SHEET_NAMES.DRAFTS);

  let drafts = rows.map(row => {
    const createdAt = new Date(row.created_at);
    const updatedAt = row.updated_at ? new Date(row.updated_at) : createdAt;

    return {
      id: row.id,
      content: row.content,
      basedOnPatternId: row.based_on_pattern,
      basedOnTrendId: row.based_on_trend,
      status: row.status as DraftPost['status'],
      createdAt,
      updatedAt,
    };
  });

  if (status) {
    drafts = drafts.filter(d => d.status === status);
  }

  drafts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return drafts;
}

export async function updateDraftStatus(
  draftId: string,
  status: DraftPost['status']
): Promise<boolean> {
  return updateSheetRowById(SHEET_NAMES.DRAFTS, draftId, {
    status,
    updated_at: new Date().toISOString(),
  });
}

export async function generateContent(config: GenerationConfig): Promise<GenerationResult> {
  const result: GenerationResult = {
    drafts: [],
    filtered: {
      tooLong: 0,
      duplicate: 0,
      lowQuality: 0,
      brandUnsafe: 0,
    },
    pattern: null,
    trend: null,
  };

  const [pattern, trend, duplicateContext] = await Promise.all([
    selectPattern(config),
    selectTrend(config),
    prepareDuplicateCheckContext(),
  ]);

  result.pattern = pattern;
  result.trend = trend;

  const topic = config.topic || trend?.topic || 'technology and innovation';

  const generationPrompt: GenerationPrompt = {
    topic,
    structureType: pattern?.type || config.structureType || 'educational',
    hookTemplate: pattern?.hookTemplate,
    ctaTemplate: pattern?.ctaTemplate || undefined,
    targetLength: pattern?.avgLength || 200,
    emojiDensity: config.emojiDensity || (pattern?.emojiDensity && pattern.emojiDensity > 0.02 ? 'medium' : 'low'),
    tone: config.tone,
  };

  const variantCount = config.variantCount || CONTENT_LIMITS.AI_VARIANTS_COUNT;
  const generated = await generateMultipleTweets(generationPrompt, variantCount);

  for (const content of generated) {
    const qualityResult = runQualityChecksWithContext(content.content, duplicateContext);

    if (!qualityResult.passed) {
      switch (qualityResult.category) {
        case 'length':
          result.filtered.tooLong++;
          break;
        case 'duplicate':
          result.filtered.duplicate++;
          break;
        case 'quality':
          result.filtered.lowQuality++;
          break;
        case 'brand_safety':
          result.filtered.brandUnsafe++;
          break;
      }
      continue;
    }

    duplicateContext.newlyGeneratedContents.push(content.content);

    const draft: DraftPost = {
      id: `draft_${generateId()}`,
      content: content.content,
      basedOnPatternId: pattern?.id || '',
      basedOnTrendId: trend?.id || '',
      status: config.autoApprove ? 'approved' : 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    result.drafts.push(draft);
  }

  if (result.drafts.length > 0) {
    await saveDraftsToSheet(result.drafts);
  }

  return result;
}

export async function regenerateContent(
  draftId: string,
  config?: Partial<GenerationConfig>
): Promise<GenerationResult> {
  const drafts = await getDraftsFromSheet();
  const existingDraft = drafts.find(d => d.id === draftId);

  if (!existingDraft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  return generateContent({
    patternId: existingDraft.basedOnPatternId || undefined,
    trendId: existingDraft.basedOnTrendId || undefined,
    variantCount: 1,
    ...config,
  });
}

export interface InspirationGenerationResult {
  drafts: DraftPost[];
  filtered: {
    tooLong: number;
    duplicate: number;
    lowQuality: number;
    brandUnsafe: number;
  };
}

export async function generateFromInspirationPosts(
  inspirationPosts: InspirationPost[],
  count: number = 4
): Promise<InspirationGenerationResult> {
  const result: InspirationGenerationResult = {
    drafts: [],
    filtered: {
      tooLong: 0,
      duplicate: 0,
      lowQuality: 0,
      brandUnsafe: 0,
    },
  };

  if (inspirationPosts.length === 0) {
    return result;
  }

  const [generated, duplicateContext] = await Promise.all([
    generateFromInspiration(inspirationPosts, count),
    prepareDuplicateCheckContext(),
  ]);

  for (const content of generated) {
    const qualityResult = runQualityChecksWithContext(content.content, duplicateContext);

    if (!qualityResult.passed) {
      switch (qualityResult.category) {
        case 'length':
          result.filtered.tooLong++;
          break;
        case 'duplicate':
          result.filtered.duplicate++;
          break;
        case 'quality':
          result.filtered.lowQuality++;
          break;
        case 'brand_safety':
          result.filtered.brandUnsafe++;
          break;
      }
      continue;
    }

    duplicateContext.newlyGeneratedContents.push(content.content);

    const draft: DraftPost = {
      id: `draft_${generateId()}`,
      content: content.content,
      basedOnPatternId: '',
      basedOnTrendId: '',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    result.drafts.push(draft);
  }

  if (result.drafts.length > 0) {
    await saveDraftsToSheet(result.drafts);
  }

  return result;
}
