import OpenAI from 'openai';
import { getEnv } from '@/lib/env';
import { CONTENT_LIMITS } from '@/constants/rate-limits.constants';

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const env = getEnv();
  _client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  return _client;
}

export interface GenerationPrompt {
  topic: string;
  structureType: string;
  hookTemplate?: string;
  ctaTemplate?: string;
  targetLength?: number;
  emojiDensity?: 'none' | 'low' | 'medium' | 'high';
  tone?: string;
  avoidPhrases?: string[];
}

export interface InspirationPost {
  content: string;
  metrics: { likes: number; retweets: number };
  structure: string;
  author: string;
}

export interface GeneratedContent {
  content: string;
  structureType: string;
  estimatedEngagement: 'low' | 'medium' | 'high';
}

const STRUCTURE_GUIDELINES: Record<string, string> = {
  hook_story: `Start with a compelling hook that draws readers in immediately. Use phrases like "I just...", "Here's what happened...", or "Story time:". Build narrative tension and end with a lesson or insight.`,
  list_format: `Structure the tweet as a numbered or bulleted list. Start with a strong headline, then provide 3-5 clear, actionable points. Each point should be concise and valuable on its own.`,
  question_answer: `Open with a thought-provoking question that your audience cares about. Then provide a clear, insightful answer. The question should create curiosity and the answer should deliver value.`,
  controversial_take: `Present a bold, contrarian opinion that challenges conventional wisdom. Use phrases like "Unpopular opinion:" or "Hot take:". Support with reasoning but keep it punchy.`,
  thread_starter: `Write a compelling thread opener that promises value. Use "🧵" or "Thread:" to signal it's a thread. Create anticipation for what's coming next.`,
  call_to_action: `Deliver value first, then include a clear call-to-action. The CTA should feel natural and earned, not pushy. Common CTAs: follow for more, retweet if you agree, drop a comment.`,
  educational: `Teach something valuable in a clear, accessible way. Use "Here's how...", "Quick tip:", or "Most people don't know...". Break complex ideas into simple steps.`,
  humor: `Be genuinely funny or witty. Use relatable observations, clever wordplay, or unexpected twists. Humor should feel natural, not forced.`,
};

const EMOJI_GUIDELINES: Record<string, string> = {
  none: 'Do not use any emojis.',
  low: 'Use 1-2 emojis sparingly, only where they add emphasis.',
  medium: 'Use 3-4 emojis to add personality and visual breaks.',
  high: 'Use 5+ emojis throughout to create energy and visual appeal.',
};

function buildSystemPrompt(): string {
  return `You are an expert social media content creator specializing in viral Twitter/X posts. Your goal is to create original, engaging content that resonates with audiences and drives engagement.

Key principles:
- Create ORIGINAL content inspired by patterns, never copy or closely paraphrase existing tweets
- Match the requested structure and tone precisely
- Stay within the 280 character limit for Twitter
- Write in a natural, authentic voice
- Avoid clichés, generic statements, and corporate speak
- Never use hashtags unless specifically requested
- Focus on providing genuine value or entertainment

Quality standards:
- Every word should earn its place
- Strong hooks that stop the scroll
- Clear, punchy language
- Specific over generic (use concrete examples)
- Emotional resonance (curiosity, surprise, recognition)`;
}

function buildUserPrompt(params: GenerationPrompt): string {
  const structureGuide = STRUCTURE_GUIDELINES[params.structureType] || STRUCTURE_GUIDELINES.educational;
  const emojiGuide = EMOJI_GUIDELINES[params.emojiDensity || 'low'];

  let prompt = `Create an original tweet about: "${params.topic}"

Structure type: ${params.structureType}
${structureGuide}

${emojiGuide}`;

  if (params.hookTemplate) {
    prompt += `\n\nUse this hook style as inspiration (adapt it, don't copy): "${params.hookTemplate}"`;
  }

  if (params.ctaTemplate) {
    prompt += `\n\nInclude a call-to-action similar to: "${params.ctaTemplate}"`;
  }

  if (params.targetLength) {
    prompt += `\n\nTarget length: approximately ${params.targetLength} characters (max 280)`;
  }

  if (params.tone) {
    prompt += `\n\nTone: ${params.tone}`;
  }

  if (params.avoidPhrases && params.avoidPhrases.length > 0) {
    prompt += `\n\nAvoid these phrases: ${params.avoidPhrases.join(', ')}`;
  }

  prompt += `\n\nRespond with ONLY the tweet text, no quotes, no explanation, no additional commentary.`;

  return prompt;
}

export async function generateSingleTweet(params: GenerationPrompt): Promise<GeneratedContent> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(params) },
    ],
    max_tokens: 150,
    temperature: 0.8,
  });

  const content = response.choices[0]?.message?.content?.trim() || '';

  const estimatedEngagement = estimateEngagement(content, params.structureType);

  return {
    content,
    structureType: params.structureType,
    estimatedEngagement,
  };
}

export async function generateMultipleTweets(
  params: GenerationPrompt,
  count: number = CONTENT_LIMITS.AI_VARIANTS_COUNT
): Promise<GeneratedContent[]> {
  const client = getOpenAIClient();

  const systemPrompt = buildSystemPrompt();
  const baseUserPrompt = buildUserPrompt(params);

  const userPrompt = `${baseUserPrompt}

Generate exactly ${count} different tweet variations. Each should have a unique angle or approach while staying on topic.

Format your response as a JSON array of strings, like this:
["Tweet 1 content here", "Tweet 2 content here", "Tweet 3 content here"]

Respond with ONLY the JSON array, no additional text.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 800,
    temperature: 0.9,
  });

  const responseText = response.choices[0]?.message?.content?.trim() || '[]';

  let tweets: string[];
  try {
    tweets = JSON.parse(responseText);
    if (!Array.isArray(tweets)) {
      tweets = [responseText];
    }
  } catch {
    const lines = responseText.split('\n').filter(line => line.trim() && !line.startsWith('[') && !line.startsWith(']'));
    tweets = lines.map(line => line.replace(/^["'\d.\-)\]]+\s*/, '').replace(/["',]+$/, '').trim());
  }

  return tweets.map(content => ({
    content: content.slice(0, CONTENT_LIMITS.MAX_TWEET_LENGTH),
    structureType: params.structureType,
    estimatedEngagement: estimateEngagement(content, params.structureType),
  }));
}

function estimateEngagement(content: string, structureType: string): 'low' | 'medium' | 'high' {
  let score = 0;

  if (content.length >= 100 && content.length <= 240) score += 2;
  else if (content.length >= 50 && content.length <= 280) score += 1;

  if (content.includes('?')) score += 1;

  const highEngagementTypes = ['controversial_take', 'question_answer', 'thread_starter', 'humor'];
  if (highEngagementTypes.includes(structureType)) score += 2;

  const powerWords = ['secret', 'mistake', 'never', 'always', 'best', 'worst', 'truth', 'real', 'actually', 'most people'];
  const lowerContent = content.toLowerCase();
  for (const word of powerWords) {
    if (lowerContent.includes(word)) {
      score += 1;
      break;
    }
  }

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length >= 2 && lines.length <= 5) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

export async function improveContent(
  content: string,
  feedback: string
): Promise<GeneratedContent> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: `Improve this tweet based on the feedback provided.

Original tweet:
"${content}"

Feedback:
${feedback}

Respond with ONLY the improved tweet text, no quotes, no explanation.`,
      },
    ],
    max_tokens: 150,
    temperature: 0.7,
  });

  const improvedContent = response.choices[0]?.message?.content?.trim() || content;

  return {
    content: improvedContent.slice(0, CONTENT_LIMITS.MAX_TWEET_LENGTH),
    structureType: 'unknown',
    estimatedEngagement: estimateEngagement(improvedContent, 'unknown'),
  };
}

export async function generateFromInspiration(
  inspirationPosts: InspirationPost[],
  count: number = 4
): Promise<GeneratedContent[]> {
  const client = getOpenAIClient();

  const sortedPosts = [...inspirationPosts].sort(
    (a, b) => (b.metrics.likes + b.metrics.retweets * 2) - (a.metrics.likes + a.metrics.retweets * 2)
  );

  const examplesText = sortedPosts.slice(0, 5).map((post, i) =>
    `${i + 1}. "${post.content}"`
  ).join('\n\n');

  const structures = sortedPosts.map(p => p.structure).filter(s => s && s !== 'general');
  const dominantStructure = structures.length > 0
    ? structures.sort((a, b) => structures.filter(s => s === b).length - structures.filter(s => s === a).length)[0]
    : 'educational';

  const systemPrompt = `You write viral tweets. Study examples and write new ones that sound like them.

CRITICAL RULES:
- COPY THE EXACT WRITING STYLE of the examples (if casual, be casual. if news-style, be news-style)
- MENTION SPECIFIC NAMES, TOPICS, SHOWS, PEOPLE from the examples - don't be vague
- DO NOT add "BREAKING:" or "JUST IN:" unless the examples actually use them
- Keep the same tone - if examples are sarcastic observations, yours should be too
- Under 280 characters
- No hashtags`;

  const userPrompt = `Examples of viral tweets to mimic:

${examplesText}

Write ${count} new tweets that:
1. Sound like the examples (same voice, same style)
2. Are about the SAME topics/subjects mentioned
3. Use specific names and references (not "a show" or "a series" - say the actual name)
4. Feel authentic, not like news headlines

JSON array only: ["tweet1", "tweet2"]`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 1000,
    temperature: 0.85,
  });

  const responseText = response.choices[0]?.message?.content?.trim() || '[]';

  let tweets: string[];
  try {
    tweets = JSON.parse(responseText);
    if (!Array.isArray(tweets)) {
      tweets = [responseText];
    }
  } catch {
    const lines = responseText.split('\n').filter(line => line.trim() && !line.startsWith('[') && !line.startsWith(']'));
    tweets = lines.map(line => line.replace(/^["'\d.\-)\]]+\s*/, '').replace(/["',]+$/, '').trim());
  }

  return tweets.map(content => ({
    content: content.slice(0, CONTENT_LIMITS.MAX_TWEET_LENGTH),
    structureType: dominantStructure,
    estimatedEngagement: estimateEngagement(content, dominantStructure),
  }));
}
