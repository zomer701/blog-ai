'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Article } from '@/lib/api';

type Language = 'en' | 'es' | 'ukr';

type Props = {
  article: Article;
};

export function ArticlePageClient({ article }: Props) {
  const router = useRouter();

  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    null
  );

  const LANGS = useMemo(() => ['ukr', 'es', 'en'] as const, []);

  const getPathLanguage = useCallback((): Language | null => {
    if (typeof window === 'undefined') return null;
    const parts = window.location.pathname.split('/').filter(Boolean);
    const candidate = parts[0]?.toLowerCase();
    return LANGS.includes(candidate as Language)
      ? (candidate as Language)
      : null;
  }, [LANGS]);

  const getCookieLanguage = useCallback((): Language | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )preferred_lang=([^;]+)/);
    const value = match ? decodeURIComponent(match[1]) : null;
    return LANGS.includes(value as Language) ? (value as Language) : null;
  }, [LANGS]);

  const setCookieLanguage = useCallback((lang: Language) => {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `preferred_lang=${encodeURIComponent(
      lang
    )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }, []);

  const getQueryLanguage = useCallback((): Language | null => {
    if (typeof window === 'undefined') return null;
    const value = new URLSearchParams(window.location.search).get('lang');
    return value && LANGS.includes(value as Language)
      ? (value as Language)
      : null;
  }, [LANGS]);

  const baseLanguage = useMemo(() => {
    const pathLang = getPathLanguage();
    const cookieLang = getCookieLanguage();
    const paramLang = getQueryLanguage();
    return (paramLang || pathLang || cookieLang || 'en') as Language;
  }, [getCookieLanguage, getPathLanguage, getQueryLanguage]);

  const language = selectedLanguage ?? baseLanguage;

  useEffect(() => {
    setCookieLanguage(language);
  }, [language, setCookieLanguage]);

  useEffect(() => {
    api.trackView(article.id);
  }, [article.id]);

  const changeLanguage = useCallback(
    (newLang: Language) => {
      setSelectedLanguage(newLang);
      router.push(`/article/${article.id}?lang=${newLang}`);
    },
    [article.id, router]
  );

  const getTitle = useCallback(
    (item: Article | null) => {
      if (!item) return '';
      if (language === 'es' && item.translations?.es)
        return item.translations.es.title;
      if (language === 'ukr' && item.translations?.ukr)
        return item.translations.ukr.title;
      return item.title;
    },
    [language]
  );

  const getContent = useCallback(
    (item: Article | null) => {
      if (!item) return '';
      if (language === 'es' && item.translations?.es)
        return item.translations.es.content;
      if (language === 'ukr' && item.translations?.ukr)
        return item.translations.ukr.content;
      return item.content.text;
    },
    [language]
  );

  const tagColorMap: Record<string, string> = {
    openai: '#10A37F',
    chatgpt: '#10A37F',
    deepmind: '#4285F4',
    google: '#4285F4',
    nvidia: '#76B900',
    meta: '#0064E0',
    facebook: '#0064E0',
    huggingface: '#FFD21E',
    hf: '#FFD21E',
    scale: '#000000',
    'scale ai': '#000000',
    scaleai: '#000000',
    anthropic: '#D97757',
    claude: '#D97757',
    arxiv: '#B31B1B',
  };

  const tagClass = (tag: string) => {
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
  };

  const tagTint = (tag?: string) => {
    if (!tag) return 'rgba(0,0,0,0.03)';
    const key = tag.toLowerCase();
    const hex = tagColorMap[key];
    if (!hex) return 'rgba(0,0,0,0.03)';
    const value = hex.replace('#', '');
    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.08)`;
  };

  const primaryTag = article.metadata.tags?.[0];
  const isArxiv =
    article.metadata.tags?.some((tag) => tag.toLowerCase() === 'arxiv') ??
    false;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const heroMedia = article.content.images?.[0];
  const bodyImages = article.content.images?.slice(1) ?? [];

  const contentBlocks = getContent(article)
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const imageMatch = paragraph.match(/^\[\[IMAGE_(\d+)(?:\|(.*))?\]\]$/);
      if (imageMatch) {
        const idx = Number(imageMatch[1]);
        const src = article.content.images?.[idx];
        const caption = imageMatch[2]?.trim();
        return { type: 'image' as const, src, caption };
      }

      const isCodeBlock =
        paragraph.startsWith('```') && paragraph.endsWith('```');
      if (isCodeBlock) {
        return {
          type: 'code' as const,
          value: paragraph.slice(3, -3).trim(),
        };
      }

      const looksHtml = /<div[^>]*>|<p[^>]*>|<figure[^>]*>/i.test(paragraph);
      if (looksHtml) {
        return { type: 'html' as const, value: paragraph };
      }

      const lines = paragraph.split('\n').map((l) => l.trim());
      const isList = lines.every((line) => line.startsWith('- '));
      if (isList) {
        return {
          type: 'list' as const,
          items: lines.map((line) => line.replace(/^- /, '').trim()),
        };
      }

      const looksMath = /\\\\[a-zA-Z]+|Ω|→|∞|∑|\\bpi\\b|\\bsigma\\b|\\btheta\\b|\\blambda\\b|\\balpha\\b|\\bbeta\\b|\\bmathcal\\b|\\bmathtt\\b|\\bleq\\b|\\bgeq\\b|\\bneq\\b/.test(
        paragraph
      );
      if (looksMath) {
        return { type: 'math' as const, value: paragraph };
      }

      return { type: 'paragraph' as const, value: paragraph };
    });

  const hasImagePlaceholders = contentBlocks.some((b) => b.type === 'image');
  const isVideoHero =
    !!heroMedia && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(heroMedia.split('?')[0]);
  const arxivFallbackHero = '/articles/sample-arxiv-decision-making-agents-hero.svg';
  const pdfUrl =
    isArxiv && article.source_url.includes('/abs/')
      ? article.source_url.replace('/abs/', '/pdf/')
      : null;

  return (
    <div
      className={`min-h-screen bg-gradient-to-b text-gray-900 ${
        isArxiv ? 'from-red-50 via-white to-amber-50' : 'from-gray-50 via-white to-gray-100'
      }`}
      style={{ backgroundColor: tagTint(primaryTag) }}
    >
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              prefetch={false}
              aria-label="Home"
              onClick={(e) => {
                e.preventDefault();
                window.location.assign('/');
              }}
              className="flex items-center gap-2"
            >
              <img
                src="/icon.png"
                alt="GenAI Agent News"
                className="h-10 w-10 rounded-xl border border-black/5 bg-white object-cover shadow-md"
              />
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-600">
                GenAI Agent News
              </span>
            </Link>
            <Link
              href="/"
              aria-label="Back to feed"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/80 text-lg font-semibold text-gray-800 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
            >
              ←
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-gray-100/80 px-2 py-1 text-sm text-gray-700 shadow-inner">
              {(['ukr', 'es', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                    language === lang
                      ? 'bg-white text-gray-900 shadow'
                      : 'hover:bg-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:pt-10">
        <article
          className={`overflow-hidden rounded-3xl border bg-white shadow-2xl shadow-black/10 ${
            isArxiv ? 'border-red-100' : 'border-black/5'
          }`}
        >
          <div className="relative">
            {heroMedia || (isArxiv && arxivFallbackHero) ? (
              isVideoHero ? (
                <video
                  src={heroMedia}
                  controls
                  playsInline
                  className="h-[48vh] w-full object-cover sm:h-[55vh]"
                />
              ) : (
                <img
                  src={heroMedia || arxivFallbackHero}
                  alt={article.title}
                  className="h-[48vh] w-full object-cover sm:h-[55vh]"
                  loading="lazy"
                />
              )
            ) : (
              <div className="flex h-[42vh] w-full items-center justify-center bg-gradient-to-br from-gray-200 via-gray-100 to-gray-300 text-gray-50">
                <div className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white">
                  No Media
                </div>
              </div>
            )}
            <div
              className={`absolute inset-0 bg-gradient-to-t ${
                isArxiv
                  ? 'from-red-900/85 via-red-800/40 to-transparent'
                  : 'from-black/80 via-black/30 to-transparent'
              }`}
            />
            <div className="absolute bottom-0 left-0 right-0 space-y-3 px-5 pb-6 sm:px-7 sm:pb-7">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-white/80">
                <span className="rounded-full bg-white/15 px-3 py-1">{article.source}</span>
                <span className="h-1 w-1 rounded-full bg-white/50" />
                <time>{formatDate(article.published_date)}</time>
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {getTitle(article)}
              </h1>
              <p className="text-sm text-white/80">By {article.author}</p>

              {isArxiv && (
                <div className="flex flex-wrap gap-3 pt-2">
                  {pdfUrl ? (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-800 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                    >
                      View PDF
                    </a>
                  ) : null}
                  <a
                    href={article.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm transition hover:-translate-y-[1px] hover:bg-white/30"
                  >
                    View on arXiv
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[2fr,1fr] lg:gap-10">
            <div
              className={`prose prose-lg max-w-none text-gray-800 ${
                isArxiv
                  ? 'arxiv-prose prose-headings:text-gray-900 prose-h2:mt-8 prose-h3:mt-6 prose-p:text-gray-800'
                  : ''
              }`}
            >
              {contentBlocks.map((block, index) => {
                if (block.type === 'code') {
                  return (
                    <pre
                      key={index}
                      className="article-code overflow-x-auto whitespace-pre rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs font-mono text-gray-900 shadow-inner sm:text-sm"
                    >
                      <code>{block.value}</code>
                    </pre>
                  );
                }

                if (block.type === 'math') {
                  return (
                    <pre
                      key={index}
                      className="article-math overflow-x-auto whitespace-pre-wrap rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-mono leading-7 text-red-900 shadow-inner"
                    >
                      {block.value}
                    </pre>
                  );
                }

                if (block.type === 'list') {
                  return (
                    <ul key={index} className="list-disc space-y-2 pl-6">
                      {block.items.map((item, idx) => (
                        <li key={idx} className="leading-relaxed text-gray-800">
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }

                if (block.type === 'html') {
                  return (
                    <div
                      key={index}
                      className="article-html-block"
                      dangerouslySetInnerHTML={{ __html: block.value }}
                    />
                  );
                }

                if (block.type === 'image') {
                  if (!block.src) return null;
                  return (
                    <figure
                      key={index}
                      className="overflow-hidden rounded-2xl border border-black/5 bg-gray-50 shadow-sm"
                    >
                      <img
                        src={block.src}
                        alt={block.caption || article.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {block.caption ? (
                        <figcaption className="px-4 py-2 text-xs text-gray-600">
                          {block.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  );
                }

                return (
                  <p key={index} className="leading-relaxed text-gray-800">
                    {block.value}
                  </p>
                );
              })}

              {!hasImagePlaceholders && bodyImages.length > 0 && (
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {bodyImages.map((img, idx) => (
                    <figure
                      key={idx}
                      className="overflow-hidden rounded-2xl border border-black/5 bg-gray-50 shadow-sm"
                    >
                      <img
                        src={img}
                        alt={article.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <figcaption className="px-4 py-2 text-xs text-gray-600">
                        {article.source}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>

            <aside className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-gray-50/80 p-5 text-sm text-gray-700 shadow-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-800"
                >
                  {article.source} ↗
                </a>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {article.metadata.tags.map((tag) => (
                    <span key={tag} className={`blog-tag ${tagClass(tag)}`}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </article>
      </main>
    </div>
  );
}
