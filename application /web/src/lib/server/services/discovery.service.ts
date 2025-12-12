import {
  fetchTrendingTopics,
  searchViralTweets,
  TwitterApiTierError,
} from './twitter.service';
import {
  appendSheetRows,
  getSheetRows,
} from './sheets.service';
import {
  selectBestPatterns,
  aggregatePatternsByType,
  type AnalysisResult,
} from './pattern-analyzer.service';
import { hashString } from '@/lib/utils/id';
import { SHEET_NAMES, type TrendsSheetRow, type ViralPostsSheetRow, type PatternsSheetRow } from '@/types/sheets.types';
import type { TrendingTopic, ViralPost, TweetPattern, TweetStructureType } from '@/types/twitter.types';

export interface DiscoveryConfig {
  keywords?: string[];
  maxTweetsPerKeyword?: number;
  woeid?: number;
}

export interface DiscoveryResult {
  trends: TrendingTopic[];
  viralPosts: ViralPost[];
  errors: string[];
}

const DEFAULT_KEYWORDS = [
  'tech',
  'startup',
  'AI',
  'programming',
  'javascript',
  'typescript',
];

const TREND_DEDUPE_HOURS = 4;

function trendToSheetRow(trend: TrendingTopic): string[] {
  return [
    trend.id,
    trend.topic,
    trend.keyword,
    String(trend.tweetCount),
    String(trend.woeid),
    trend.fetchedAt.toISOString(),
  ];
}

function makeTrendKey(topic: string, woeid: number | string): string {
  return `${topic.toLowerCase()}:${woeid}`;
}

function viralPostToSheetRow(post: ViralPost): string[] {
  return [
    post.id,
    post.tweetId,
    post.author,
    post.content,
    String(post.likes),
    String(post.retweets),
    String(post.engagementRate),
    post.structureType,
    post.fetchedAt.toISOString(),
  ];
}

export async function discoverTrends(woeid: number = 1): Promise<{ trends: TrendingTopic[]; error?: string }> {
  try {
    const trends = await fetchTrendingTopics(woeid);
    return { trends };
  } catch (error) {
    if (error instanceof TwitterApiTierError) {
      return { trends: [], error: error.message };
    }
    throw error;
  }
}

export async function discoverViralTweets(
  keywords: string[],
  maxPerKeyword: number = 20
): Promise<{ posts: ViralPost[]; errors: string[] }> {
  const allPosts: ViralPost[] = [];
  const errors: string[] = [];
  const seenTweetIds = new Set<string>();

  for (const keyword of keywords) {
    try {
      const posts = await searchViralTweets({
        query: `${keyword} -is:retweet -is:reply lang:en`,
        maxResults: maxPerKeyword,
      });

      for (const post of posts) {
        if (!seenTweetIds.has(post.tweetId)) {
          seenTweetIds.add(post.tweetId);
          allPosts.push(post);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to search "${keyword}": ${message}`);
    }
  }

  return { posts: allPosts, errors };
}

export async function saveTrendsToSheet(trends: TrendingTopic[]): Promise<number> {
  if (trends.length === 0) return 0;

  const existingRows = await getSheetRows<TrendsSheetRow>(SHEET_NAMES.TRENDS);
  const cutoffTime = new Date(Date.now() - TREND_DEDUPE_HOURS * 60 * 60 * 1000);

  const recentTrendKeys = new Set<string>();
  for (const row of existingRows) {
    const fetchedAt = new Date(row.fetched_at);
    if (fetchedAt > cutoffTime) {
      recentTrendKeys.add(makeTrendKey(row.topic, row.woeid || '1'));
    }
  }

  const newTrends = trends.filter(trend => !recentTrendKeys.has(makeTrendKey(trend.topic, trend.woeid)));
  if (newTrends.length === 0) return 0;

  const rows = newTrends.map(trendToSheetRow);
  await appendSheetRows(SHEET_NAMES.TRENDS, rows);
  return newTrends.length;
}

export async function saveViralPostsToSheet(posts: ViralPost[]): Promise<number> {
  if (posts.length === 0) return 0;

  const existingRows = await getSheetRows<ViralPostsSheetRow>(SHEET_NAMES.VIRAL_POSTS);
  const existingTweetIds = new Set(existingRows.map(row => row.tweet_id));

  const newPosts = posts.filter(post => !existingTweetIds.has(post.tweetId));
  if (newPosts.length === 0) return 0;

  const rows = newPosts.map(viralPostToSheetRow);
  await appendSheetRows(SHEET_NAMES.VIRAL_POSTS, rows);
  return newPosts.length;
}

export async function runDiscovery(config: DiscoveryConfig = {}): Promise<DiscoveryResult> {
  const {
    keywords = DEFAULT_KEYWORDS,
    maxTweetsPerKeyword = 20,
    woeid = 1,
  } = config;

  const result: DiscoveryResult = {
    trends: [],
    viralPosts: [],
    errors: [],
  };

  const { trends, error: trendError } = await discoverTrends(woeid);
  if (trendError) {
    result.errors.push(trendError);
  }
  result.trends = trends;

  const searchKeywords = trends.length > 0
    ? trends.slice(0, 10).map(t => t.keyword)
    : keywords;

  const { posts, errors: searchErrors } = await discoverViralTweets(searchKeywords, maxTweetsPerKeyword);
  result.viralPosts = posts;
  result.errors.push(...searchErrors);

  if (trends.length > 0) {
    await saveTrendsToSheet(trends);
  }

  if (posts.length > 0) {
    await saveViralPostsToSheet(posts);
  }

  return result;
}

export async function getTrendsFromSheet(latestOnly: boolean = true): Promise<TrendingTopic[]> {
  const rows = await getSheetRows<TrendsSheetRow>(SHEET_NAMES.TRENDS);

  const trends = rows.map(row => ({
    id: row.id,
    topic: row.topic,
    keyword: row.keyword,
    tweetCount: parseInt(row.tweet_count, 10) || 0,
    woeid: parseInt(row.woeid, 10) || 1,
    fetchedAt: new Date(row.fetched_at),
  }));

  trends.sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());

  if (!latestOnly || trends.length === 0) {
    return trends;
  }

  const latestTimestamp = trends[0].fetchedAt.getTime();
  const batchWindow = 5 * 60 * 1000;

  return trends.filter(t => latestTimestamp - t.fetchedAt.getTime() <= batchWindow);
}

export interface GetViralPostsOptions {
  recencyHours?: number;
}

export async function getViralPostsFromSheet(options: GetViralPostsOptions = {}): Promise<ViralPost[]> {
  const rows = await getSheetRows<ViralPostsSheetRow>(SHEET_NAMES.VIRAL_POSTS);

  const posts = rows.map(row => ({
    id: row.id,
    tweetId: row.tweet_id,
    author: row.author,
    authorId: '',
    content: row.content,
    likes: parseInt(row.likes, 10) || 0,
    retweets: parseInt(row.retweets, 10) || 0,
    replies: 0,
    impressions: 0,
    engagementRate: parseFloat(row.engagement_rate) || 0,
    structureType: row.structure_type as ViralPost['structureType'],
    fetchedAt: new Date(row.fetched_at),
  }));

  let filteredPosts = posts;

  if (options.recencyHours !== undefined && options.recencyHours > 0) {
    const cutoffTime = new Date(Date.now() - options.recencyHours * 60 * 60 * 1000);
    filteredPosts = posts.filter(post => post.fetchedAt >= cutoffTime);
  }

  filteredPosts.sort((a, b) => b.engagementRate - a.engagementRate);

  return filteredPosts;
}

export async function searchViralByKeyword(keyword: string, maxResults: number = 50): Promise<ViralPost[]> {
  const posts = await searchViralTweets({
    query: `${keyword} -is:retweet -is:reply lang:en`,
    maxResults,
  });

  return posts;
}

const ANALYSIS_RECENCY_HOURS = 72;

function patternToSheetRow(pattern: TweetPattern): string[] {
  return [
    pattern.id,
    pattern.type,
    pattern.hookTemplate,
    pattern.ctaTemplate || '',
    String(pattern.avgLength),
    String(pattern.emojiDensity),
    pattern.exampleId,
  ];
}

function makePatternKey(type: string, hookTemplate: string): string {
  const templateHash = hashString(hookTemplate.toLowerCase());
  return `${type}:${templateHash}`;
}

export async function savePatternsToSheet(patterns: TweetPattern[]): Promise<number> {
  if (patterns.length === 0) return 0;

  const existingRows = await getSheetRows<PatternsSheetRow>(SHEET_NAMES.PATTERNS);
  const existingKeys = new Set(
    existingRows.map(row => makePatternKey(row.type, row.hook_template))
  );

  const newPatterns = patterns.filter(
    pattern => !existingKeys.has(makePatternKey(pattern.type, pattern.hookTemplate))
  );

  if (newPatterns.length === 0) return 0;

  const rows = newPatterns.map(patternToSheetRow);
  await appendSheetRows(SHEET_NAMES.PATTERNS, rows);
  return newPatterns.length;
}

export async function getPatternsFromSheet(): Promise<TweetPattern[]> {
  const rows = await getSheetRows<PatternsSheetRow>(SHEET_NAMES.PATTERNS);

  return rows.map(row => ({
    id: row.id,
    type: row.type as TweetStructureType,
    hookTemplate: row.hook_template,
    ctaTemplate: row.cta_template || null,
    avgLength: parseInt(row.avg_length, 10) || 0,
    emojiDensity: parseFloat(row.emoji_density) || 0,
    exampleId: row.example_id,
  }));
}

export async function getPatternsByType(type: TweetStructureType): Promise<TweetPattern[]> {
  const patterns = await getPatternsFromSheet();
  return patterns.filter(p => p.type === type);
}

export interface PatternAnalysisConfig {
  maxPatternsPerType?: number;
  recencyHours?: number;
}

export async function runPatternAnalysis(
  config: PatternAnalysisConfig = {}
): Promise<AnalysisResult> {
  const {
    maxPatternsPerType = 3,
    recencyHours = ANALYSIS_RECENCY_HOURS,
  } = config;

  const posts = await getViralPostsFromSheet({ recencyHours });

  if (posts.length === 0) {
    return {
      totalPostsAnalyzed: 0,
      patternsExtracted: 0,
      patternsByType: {},
      patterns: [],
    };
  }

  const aggregated = aggregatePatternsByType(posts);
  const patterns = selectBestPatterns(posts, maxPatternsPerType);

  const patternsByType: AnalysisResult['patternsByType'] = {};
  for (const [type, agg] of aggregated) {
    patternsByType[type] = {
      count: agg.sampleCount,
      avgEngagement: agg.avgEngagementRate,
      avgScore: agg.avgScore,
      topHooks: agg.hookTemplates.slice(0, 5),
    };
  }

  const savedCount = await savePatternsToSheet(patterns);

  return {
    totalPostsAnalyzed: posts.length,
    patternsExtracted: savedCount,
    patternsByType,
    patterns,
  };
}
