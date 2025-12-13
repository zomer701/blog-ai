'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { forwardRef, useMemo, useRef } from 'react';
import type { Article } from '@/lib/api';

type Language = 'en' | 'es' | 'ukr';

type ArticleCardProps = {
  article: Article;
  language: Language;
  onSwipe?: (direction: 'up' | 'down') => void;
  className?: string;
  onTagSelect?: (tag: string) => void;
};

function tagClass(tag: string) {
  const key = tag.toLowerCase();
  if (['openai', 'chatgpt'].includes(key)) return 'tag-openai';
  if (['deepmind', 'google'].includes(key)) return 'tag-deepmind';
  if (['nvidia'].includes(key)) return 'tag-nvidia';
  if (['meta', 'facebook'].includes(key)) return 'tag-meta';
  if (['huggingface', 'hf'].includes(key)) return 'tag-huggingface';
  if (['scale', 'scaleai', 'scale ai'].includes(key)) return 'tag-scale';
  if (['anthropic', 'claude'].includes(key)) return 'tag-anthropic';
  if (['arxiv'].includes(key)) return 'tag-arxiv';
  return '';
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function getTranslatedTitle(article: Article, language: Language) {
  if (language === 'es' && article.translations?.es) {
    return article.translations.es.title;
  }
  if (language === 'ukr' && article.translations?.ukr) {
    return article.translations.ukr.title;
  }
  return article.title;
}

function getTranslatedBody(article: Article, language: Language) {
  if (language === 'es' && article.translations?.es) {
    return article.translations.es.content;
  }
  if (language === 'ukr' && article.translations?.ukr) {
    return article.translations.ukr.content;
  }
  return article.content.text;
}

export const ArticleCard = forwardRef<HTMLDivElement, ArticleCardProps>(
  function ArticleCard(
    { article, language, onSwipe, onTagSelect, className },
    ref
  ) {
    const touchStartY = useRef<number | null>(null);

    const arxivFallback = '/articles/sample-arxiv-decision-making-agents-hero.svg';
    const isArxiv = article.metadata.tags.some(
      (tag) => tag.toLowerCase() === 'arxiv'
    );
    const media = article.content.images?.[0] || (isArxiv ? arxivFallback : undefined);
    const hasMedia = Boolean(media);
    const isVideo =
      !!media && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(media.split('?')[0]);

    const textPreview = useMemo(() => {
      const content = getTranslatedBody(article, language).slice(0, 220);
      return content.endsWith('.') ? content : `${content}...`;
    }, [article, language]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      touchStartY.current = event.clientY;
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
      if (touchStartY.current === null) return;
      const delta = event.clientY - touchStartY.current;
      if (Math.abs(delta) > 60 && onSwipe) {
        onSwipe(delta < 0 ? 'up' : 'down');
      }
      touchStartY.current = null;
    };

    return (
      <article
        ref={ref}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className={`group relative snap-start overflow-hidden rounded-3xl border border-black/5 bg-white shadow-lg shadow-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-gray-900 dark:shadow-none ${className ?? ''}`}
        style={{ minHeight: '75vh' }}
      >
        <Link
          href={`/article/${article.id}?lang=${language}`}
          aria-label={`Open ${article.title}`}
          className="absolute inset-0 z-10 sm:hidden"
        />
        <div className="relative w-full h-[68vh] sm:h-[55vh] lg:h-[48vh]">
          {media ? (
            isVideo ? (
              <video
                src={media}
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={media}
                alt={article.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-gray-200 via-gray-100 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800">
              <span className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
                No Media
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute left-0 right-0 bottom-0 space-y-3 px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-white/70">
              <span className="rounded-full bg-white/15 px-3 py-1">
                {article.source}
              </span>
              <span className="h-1 w-1 rounded-full bg-white/50" />
              <time>{formatDate(article.published_date)}</time>
            </div>
            <h2 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {getTranslatedTitle(article, language)}
            </h2>
          </div>

          {/* Floating actions removed per requirements */}
        </div>

        <div className="flex flex-col gap-4 px-4 pb-6 pt-4 sm:px-6">
          <p className="text-base leading-relaxed text-gray-700 line-clamp-4 dark:text-gray-200">
            {textPreview}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {article.author}
            </span>
            {article.metadata.tags.slice(0, 3).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagSelect?.(tag)}
                className={`blog-tag text-xs font-semibold ${tagClass(tag)} transition hover:brightness-95`}
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </button>
            ))}
          </div>
          <Link
            href={`/article/${article.id}?lang=${language}`}
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
            aria-label="Read full story"
          >
            <span aria-hidden>→</span>
          </Link>
        </div>
      </article>
    );
  }
);
