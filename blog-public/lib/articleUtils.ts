import type { Article } from './api';

export const LANGUAGES = ['ukr', 'es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export function getLocalizedTitle(article: Article, language: Language): string {
  if (language === 'es' && article.translations?.es) {
    return article.translations.es.title;
  }
  if (language === 'ukr' && article.translations?.ukr) {
    return article.translations.ukr.title;
  }
  return article.title;
}

export function getLocalizedText(article: Article, language: Language): string {
  if (language === 'es' && article.translations?.es) {
    return article.translations.es.content;
  }
  if (language === 'ukr' && article.translations?.ukr) {
    return article.translations.ukr.content;
  }
  return article.content.text;
}

const bulletLinePattern = /^[\u2022•\-–—*]+\s*(.+)$/;

const importanceKeywords = [
  'impact',
  'important',
  'why it matters',
  'significant',
  'critical',
  'key',
  'consequence',
  'momentum',
  'accelerat',
  'advanc',
  'outlook',
];

const watchKeywords = [
  'watch',
  'monitor',
  'follow',
  'next',
  'future',
  'upcoming',
  'track',
  'expect',
  'continue',
  'look for',
];

export interface WatchNextBullet {
  text: string;
  href?: string;
}

function sanitizeText(raw: string | undefined): string {
  return raw ? raw.replace(/\r\n/g, '\n').trim() : '';
}

function splitParagraphs(text: string): string[] {
  const normalized = sanitizeText(text);
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractBulletLines(text: string, limit: number): string[] {
  const paragraphs = splitParagraphs(text);
  const bullets: string[] = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const match = line.match(bulletLinePattern);
      if (match) {
        bullets.push(match[1].trim());
        if (bullets.length >= limit) {
          return bullets;
        }
      }
    }
  }
  return bullets;
}

function toSentences(text: string): string[] {
  const normalized = sanitizeText(text).replace(/\s+/g, ' ');
  if (!normalized) return [];
  const rawSentences = normalized.split(/(?<=[.!?])\s+/);
  return rawSentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 25);
}

function takeUnique(items: string[], limit: number): string[] {
  const result: string[] = [];
  for (const item of items) {
    if (result.includes(item)) continue;
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

export function getSummaryBullets(text: string, limit = 5): string[] {
  const normalizedText = sanitizeText(text);
  if (!normalizedText) return [];
  const fromBullets = extractBulletLines(normalizedText, limit);
  if (fromBullets.length === limit) {
    return fromBullets;
  }

  const sentences = toSentences(normalizedText);
  const combined = [...fromBullets];
  for (const sentence of sentences) {
    if (combined.length >= limit) break;
    combined.push(sentence.endsWith('.') ? sentence : `${sentence}.`);
  }
  return combined.slice(0, limit);
}

export function getImportanceBullets(text: string, limit = 3): string[] {
  const normalizedText = sanitizeText(text);
  if (!normalizedText) return [];
  const sentences = toSentences(normalizedText);
  const matches = sentences.filter((sentence) =>
    importanceKeywords.some((keyword) =>
      sentence.toLowerCase().includes(keyword)
    )
  );

  if (matches.length >= limit) {
    return takeUnique(matches, limit);
  }

  const fallbackStart = Math.min(1, Math.max(0, sentences.length - limit));
  const fallback = sentences.slice(fallbackStart, fallbackStart + limit);
  return takeUnique([...matches, ...fallback], limit);
}

export function getWatchNextBullets(
  text: string,
  article: Article,
  language: Language,
  limit = 2
): WatchNextBullet[] {
  const normalizedText = sanitizeText(text);
  const sentences = toSentences(normalizedText);
  const candidates: WatchNextBullet[] = [];
  const seen = new Set<string>();

  const pushCandidate = ({ text: entryText, href }: WatchNextBullet) => {
    const trimmed = entryText.trim();
    if (!trimmed || seen.has(trimmed) || candidates.length >= limit) {
      return;
    }
    seen.add(trimmed);
    candidates.push({ text: trimmed, href });
  };

  const buildTagHref = (tag?: string) => {
    if (!tag) return null;
    const cleaned = tag.replace(/^#/, '');
    if (!cleaned) return null;
    const params = new URLSearchParams();
    params.set('tag', cleaned);
    if (language !== 'en') {
      params.set('lang', language);
    }
    return `/?${params.toString()}`;
  };

  const addTagCandidate = (textValue: string, tag?: string) => {
    const href = buildTagHref(tag);
    pushCandidate({
      text: textValue,
      href: href ?? undefined,
    });
  };

  const tags = article.metadata.tags || [];
  const [primaryTag, secondaryTag] = tags;
  if (primaryTag) {
    addTagCandidate(
      `Watch for ${primaryTag} updates from ${article.source}.`,
      primaryTag
    );
  }
  if (secondaryTag) {
    addTagCandidate(
      `Track how ${secondaryTag} orbits ${primaryTag || article.source} next.`,
      secondaryTag
    );
  }

  if (candidates.length < limit) {
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const containsKeyword = watchKeywords.some((keyword) =>
        lower.includes(keyword)
      );
      if (containsKeyword) {
        pushCandidate({
          text: sentence.endsWith('.') ? sentence : `${sentence}.`,
        });
        if (candidates.length >= limit) {
          break;
        }
      }
    }
  }

  if (candidates.length < limit) {
    addTagCandidate(`Keep an eye on future moves from ${article.source}.`);
  }

  return candidates;
}

export function formatTagLabel(tag: string): string {
  if (!tag) return '';
  if (tag === tag.toUpperCase()) return tag;
  return tag
    .split(/[-_ ]+/)
    .map((segment) => {
      if (!segment) return '';
      return `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

export function getTagClass(tag: string): string {
  const key = tag.toLowerCase();
  if (['openai', 'chatgpt'].includes(key)) return 'tag-openai';
  if (['deepmind', 'google'].includes(key)) return 'tag-deepmind';
  if (['nvidia'].includes(key)) return 'tag-nvidia';
  if (['meta', 'facebook'].includes(key)) return 'tag-meta';
  if (['huggingface', 'hf'].includes(key)) return 'tag-huggingface';
  if (['scale', 'scale ai', 'scaleai'].includes(key)) return 'tag-scale';
  if (['anthropic', 'claude'].includes(key)) return 'tag-anthropic';
  if (['arxiv'].includes(key)) return 'tag-arxiv';
  return '';
}
