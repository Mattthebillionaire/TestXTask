import { TwitterApi, TwitterApiReadWrite, TweetV2, UserV2, ApiResponseError } from 'twitter-api-v2';
import { getEnv } from '@/lib/env';
import type { TrendingTopic, ViralPost, TwitterSearchParams } from '@/types/twitter.types';
import { CONTENT_LIMITS } from '@/constants/rate-limits.constants';
import { classifyTweetStructure } from './pattern-analyzer.service';

let _client: TwitterApiReadWrite | null = null;
let _appOnlyClient: TwitterApi | null = null;

export function getTwitterClient(): TwitterApiReadWrite {
  if (_client) return _client;

  const env = getEnv();
  const client = new TwitterApi({
    appKey: env.TWITTER_API_KEY,
    appSecret: env.TWITTER_API_SECRET,
    accessToken: env.TWITTER_ACCESS_TOKEN,
    accessSecret: env.TWITTER_ACCESS_TOKEN_SECRET,
  });

  _client = client.readWrite;
  return _client;
}

export function getAppOnlyClient(): TwitterApi {
  if (_appOnlyClient) return _appOnlyClient;

  const env = getEnv();
  _appOnlyClient = new TwitterApi(env.TWITTER_BEARER_TOKEN);
  return _appOnlyClient;
}

export class TwitterApiTierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TwitterApiTierError';
  }
}

export async function fetchTrendingTopics(woeid: number = 1): Promise<TrendingTopic[]> {
  const client = getAppOnlyClient();

  try {
    const trends = await client.v1.trendsByPlace(woeid);

    return trends[0].trends.map((trend, index) => ({
      id: `trend_${Date.now()}_${index}`,
      topic: trend.name,
      keyword: trend.query,
      tweetCount: trend.tweet_volume || 0,
      woeid,
      fetchedAt: new Date(),
    }));
  } catch (error) {
    if (error instanceof ApiResponseError && error.code === 403) {
      throw new TwitterApiTierError(
        'Trends API requires Elevated or Enterprise access. ' +
        'Use searchViralTweets with hashtags as an alternative on Basic tier.'
      );
    }
    throw error;
  }
}

export async function searchViralTweets(params: TwitterSearchParams): Promise<ViralPost[]> {
  const client = getAppOnlyClient();

  const paginator = await client.v2.search(params.query, {
    max_results: Math.min(params.maxResults || 100, 100),
    'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
    'user.fields': ['username', 'public_metrics'],
    expansions: ['author_id'],
    start_time: params.startTime?.toISOString(),
    end_time: params.endTime?.toISOString(),
  });

  const tweets = paginator.tweets;
  if (!tweets || tweets.length === 0) {
    return [];
  }

  const users = new Map<string, UserV2>();
  if (paginator.includes?.users) {
    for (const user of paginator.includes.users) {
      users.set(user.id, user);
    }
  }

  const viralPosts: ViralPost[] = [];

  for (const tweet of tweets) {
    const metrics = tweet.public_metrics;
    if (!metrics) continue;

    const totalEngagement = metrics.like_count + metrics.retweet_count + metrics.reply_count;
    const impressions = metrics.impression_count || totalEngagement * 10;
    const engagementRate = impressions > 0 ? totalEngagement / impressions : 0;

    if (engagementRate < CONTENT_LIMITS.MIN_VIRAL_ENGAGEMENT_RATE) continue;

    const author = users.get(tweet.author_id || '');

    viralPosts.push({
      id: `viral_${tweet.id}`,
      tweetId: tweet.id,
      author: author?.username || 'unknown',
      authorId: tweet.author_id || '',
      content: tweet.text,
      likes: metrics.like_count,
      retweets: metrics.retweet_count,
      replies: metrics.reply_count,
      impressions,
      engagementRate,
      structureType: classifyTweetStructure(tweet.text),
      fetchedAt: new Date(),
    });
  }

  return viralPosts.sort((a, b) => b.engagementRate - a.engagementRate);
}

export async function postTweet(content: string): Promise<{ tweetId: string }> {
  const client = getTwitterClient();

  try {
    const result = await client.v2.tweet(content);
    return {
      tweetId: result.data.id,
    };
  } catch (error) {
    if (error instanceof ApiResponseError) {
      const errorMessage = error.message?.toLowerCase() || '';
      const isLengthError = errorMessage.includes('length') || errorMessage.includes('character');
      if (isLengthError) {
        throw new Error(
          `Tweet exceeds character limit. Note: URLs count as 23 chars, some characters count as 2. ` +
          `Content length: ${content.length}, limit: ${CONTENT_LIMITS.MAX_TWEET_LENGTH}`
        );
      }
    }
    throw error;
  }
}

export async function deleteTweet(tweetId: string): Promise<void> {
  const client = getTwitterClient();
  await client.v2.deleteTweet(tweetId);
}

export async function getTweet(tweetId: string): Promise<TweetV2 | null> {
  const client = getAppOnlyClient();

  try {
    const result = await client.v2.singleTweet(tweetId, {
      'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
    });
    return result.data;
  } catch {
    return null;
  }
}
