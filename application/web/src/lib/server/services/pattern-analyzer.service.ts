import type { TweetStructureType, TweetPattern, ViralPost } from '@/types/twitter.types';
import { generateId } from '@/lib/utils/id';

export function classifyTweetStructure(content: string): TweetStructureType {
  const lowerContent = content.toLowerCase();
  const lines = content.split('\n').filter(line => line.trim());

  const listPattern = /^[\d\-\•\*]\s|^\d+\./m;
  if (listPattern.test(content) || lines.length >= 3) {
    return 'list_format';
  }

  const questionPatterns = ['?', 'what', 'how', 'why', 'when', 'where', 'who'];
  if (questionPatterns.some(p => lowerContent.includes(p)) && content.includes('?')) {
    return 'question_answer';
  }

  const threadIndicators = ['thread', '🧵', '1/', '(1)', 'a thread'];
  if (threadIndicators.some(t => lowerContent.includes(t))) {
    return 'thread_starter';
  }

  const ctaPatterns = ['follow', 'retweet', 'like', 'comment', 'share', 'subscribe', 'click', 'check out', 'dm me'];
  if (ctaPatterns.some(p => lowerContent.includes(p))) {
    return 'call_to_action';
  }

  const controversialPatterns = ['unpopular opinion', 'hot take', 'controversial', 'change my mind', 'fight me'];
  if (controversialPatterns.some(p => lowerContent.includes(p))) {
    return 'controversial_take';
  }

  const educationalPatterns = ['here\'s how', 'here is how', 'tip:', 'tips:', 'learn', 'guide', 'tutorial', 'explained'];
  if (educationalPatterns.some(p => lowerContent.includes(p))) {
    return 'educational';
  }

  const humorPatterns = ['lol', 'lmao', '😂', '🤣', 'haha', 'joke'];
  if (humorPatterns.some(p => lowerContent.includes(p))) {
    return 'humor';
  }

  const hookPatterns = ['i just', 'i\'ve been', 'breaking:', 'just happened', 'story time'];
  if (hookPatterns.some(p => lowerContent.includes(p)) && content.length > 100) {
    return 'hook_story';
  }

  return 'unknown';
}

export function extractHook(content: string): string {
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() || '';

  if (firstLine.length <= 50) {
    return firstLine;
  }

  const sentences = content.split(/[.!?]/);
  return sentences[0]?.trim() || firstLine.slice(0, 50);
}

export function extractCTA(content: string): string | null {
  const lines = content.split('\n');
  const lastLine = lines[lines.length - 1]?.trim() || '';

  const ctaIndicators = ['follow', 'retweet', 'like', 'comment', 'share', 'subscribe', 'dm', 'link'];

  if (ctaIndicators.some(cta => lastLine.toLowerCase().includes(cta))) {
    return lastLine;
  }

  return null;
}

export function calculateEmojiDensity(content: string): number {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojis = content.match(emojiRegex) || [];

  return content.length > 0 ? emojis.length / content.length : 0;
}

export function analyzeTweetPattern(content: string) {
  return {
    structureType: classifyTweetStructure(content),
    hook: extractHook(content),
    cta: extractCTA(content),
    length: content.length,
    emojiDensity: calculateEmojiDensity(content),
    lineCount: content.split('\n').filter(l => l.trim()).length,
    hasHashtags: /#\w+/.test(content),
    hasMentions: /@\w+/.test(content),
    hasLinks: /https?:\/\/\S+/.test(content),
  };
}

export function generalizeToTemplate(text: string): string {
  let template = text;

  template = template.replace(/https?:\/\/\S+/g, '{link}');
  template = template.replace(/@\w+/g, '{mention}');
  template = template.replace(/#\w+/g, '{hashtag}');
  template = template.replace(/\$[A-Z]{2,5}\b/g, '{ticker}');
  template = template.replace(/\b\d{1,3}(,\d{3})+\b/g, '{number}');
  template = template.replace(/\b\d+(\.\d+)?[KkMmBb]\b/g, '{number}');
  template = template.replace(/\b\d+%/g, '{percent}');
  template = template.replace(/\b(20\d{2}|19\d{2})\b/g, '{year}');
  template = template.replace(/\b\d+\s*(years?|months?|weeks?|days?|hours?|minutes?)\b/gi, '{timeframe}');

  const topicPatterns = [
    /\b(AI|GPT|ChatGPT|OpenAI|Claude|Gemini|LLM)\b/gi,
    /\b(Bitcoin|Ethereum|crypto|NFT|Web3)\b/gi,
    /\b(React|Vue|Angular|Next\.?js|Node\.?js|TypeScript|JavaScript|Python)\b/gi,
    /\b(startup|SaaS|B2B|B2C)\b/gi,
  ];

  for (const pattern of topicPatterns) {
    template = template.replace(pattern, '{topic}');
  }

  template = template.replace(/\{topic\}(\s*\{topic\})+/g, '{topic}');

  return template;
}

export function extractHookTemplate(content: string): string {
  const hook = extractHook(content);
  return generalizeToTemplate(hook);
}

export function extractCTATemplate(content: string): string | null {
  const cta = extractCTA(content);
  if (!cta) return null;
  return generalizeToTemplate(cta);
}

export interface PatternAnalysis {
  structureType: TweetStructureType;
  hookTemplate: string;
  ctaTemplate: string | null;
  length: number;
  emojiDensity: number;
  engagementRate: number;
  lineCount: number;
  hasHashtags: boolean;
  hasMentions: boolean;
  hasLinks: boolean;
}

export function analyzeViralPost(post: ViralPost): PatternAnalysis {
  const content = post.content;

  return {
    structureType: post.structureType || classifyTweetStructure(content),
    hookTemplate: extractHookTemplate(content),
    ctaTemplate: extractCTATemplate(content),
    length: content.length,
    emojiDensity: calculateEmojiDensity(content),
    engagementRate: post.engagementRate,
    lineCount: content.split('\n').filter(l => l.trim()).length,
    hasHashtags: /#\w+/.test(content),
    hasMentions: /@\w+/.test(content),
    hasLinks: /https?:\/\/\S+/.test(content),
  };
}

export function extractPatternFromPost(post: ViralPost): TweetPattern {
  const analysis = analyzeViralPost(post);

  return {
    id: `pattern_${generateId()}`,
    type: analysis.structureType,
    hookTemplate: analysis.hookTemplate,
    ctaTemplate: analysis.ctaTemplate,
    avgLength: analysis.length,
    emojiDensity: analysis.emojiDensity,
    exampleId: post.id,
  };
}

export function calculatePatternScore(
  engagementRate: number,
  likes: number,
  retweets: number
): number {
  const engagementScore = Math.min(engagementRate * 100, 50);
  const likesScore = Math.min(Math.log10(likes + 1) * 5, 25);
  const retweetsScore = Math.min(Math.log10(retweets + 1) * 5, 25);

  return Math.round((engagementScore + likesScore + retweetsScore) * 100) / 100;
}

export interface AggregatedPattern {
  type: TweetStructureType;
  hookTemplates: string[];
  ctaTemplates: string[];
  avgLength: number;
  avgEmojiDensity: number;
  avgEngagementRate: number;
  avgScore: number;
  sampleCount: number;
  bestExampleId: string;
}

export function aggregatePatternsByType(
  posts: ViralPost[]
): Map<TweetStructureType, AggregatedPattern> {
  const grouped = new Map<TweetStructureType, {
    analyses: PatternAnalysis[];
    posts: ViralPost[];
  }>();

  for (const post of posts) {
    const analysis = analyzeViralPost(post);
    const type = analysis.structureType;

    if (!grouped.has(type)) {
      grouped.set(type, { analyses: [], posts: [] });
    }

    const group = grouped.get(type)!;
    group.analyses.push(analysis);
    group.posts.push(post);
  }

  const aggregated = new Map<TweetStructureType, AggregatedPattern>();

  for (const [type, { analyses, posts: groupPosts }] of grouped) {
    const hookTemplates = [...new Set(analyses.map(a => a.hookTemplate))].slice(0, 10);
    const ctaTemplates = [...new Set(analyses.map(a => a.ctaTemplate).filter(Boolean) as string[])].slice(0, 10);

    const avgLength = analyses.reduce((sum, a) => sum + a.length, 0) / analyses.length;
    const avgEmojiDensity = analyses.reduce((sum, a) => sum + a.emojiDensity, 0) / analyses.length;
    const avgEngagementRate = analyses.reduce((sum, a) => sum + a.engagementRate, 0) / analyses.length;

    const scores = groupPosts.map(p => calculatePatternScore(p.engagementRate, p.likes, p.retweets));
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    const bestPostIndex = scores.indexOf(Math.max(...scores));
    const bestExampleId = groupPosts[bestPostIndex]?.id || '';

    aggregated.set(type, {
      type,
      hookTemplates,
      ctaTemplates,
      avgLength: Math.round(avgLength),
      avgEmojiDensity: Math.round(avgEmojiDensity * 1000) / 1000,
      avgEngagementRate: Math.round(avgEngagementRate * 10000) / 10000,
      avgScore: Math.round(avgScore * 100) / 100,
      sampleCount: analyses.length,
      bestExampleId,
    });
  }

  return aggregated;
}

export function selectBestPatterns(
  posts: ViralPost[],
  maxPatternsPerType: number = 3
): TweetPattern[] {
  const aggregated = aggregatePatternsByType(posts);
  const patterns: TweetPattern[] = [];

  for (const [type, agg] of aggregated) {
    if (type === 'unknown') continue;

    const typePatterns: TweetPattern[] = [];

    for (let i = 0; i < Math.min(agg.hookTemplates.length, maxPatternsPerType); i++) {
      typePatterns.push({
        id: `pattern_${generateId()}`,
        type,
        hookTemplate: agg.hookTemplates[i],
        ctaTemplate: agg.ctaTemplates[i] || null,
        avgLength: agg.avgLength,
        emojiDensity: agg.avgEmojiDensity,
        exampleId: agg.bestExampleId,
      });
    }

    patterns.push(...typePatterns);
  }

  return patterns;
}

export interface AnalysisResult {
  totalPostsAnalyzed: number;
  patternsExtracted: number;
  patternsByType: Record<string, {
    count: number;
    avgEngagement: number;
    avgScore: number;
    topHooks: string[];
  }>;
  patterns: TweetPattern[];
}
