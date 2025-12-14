'use client';

import Link from 'next/link';
import { forwardRef, useMemo, useRef } from 'react';
import type { Article } from '@/lib/api';
import {
  getImportanceBullets,
  getLocalizedText,
  getLocalizedTitle,
  getSummaryBullets,
  getTagClass,
  type Language,
} from '@/lib/articleUtils';

type ArticleCardProps = {
  article: Article;
  language: Language;
  onSwipe?: (direction: 'up' | 'down') => void;
  className?: string;
  onTagSelect?: (tag: string) => void;
};

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

export const ArticleCard = forwardRef<HTMLDivElement, ArticleCardProps>(
  function ArticleCard(
    { article, language, onSwipe, onTagSelect, className },
    ref
  ) {
    const touchStartY = useRef<number | null>(null);
    const localizedTitle = useMemo(
      () => getLocalizedTitle(article, language),
      [article, language]
    );
    const localizedText = useMemo(
      () => getLocalizedText(article, language),
      [article, language]
    );

    const importanceBullets = useMemo(
      () => getImportanceBullets(localizedText, 2),
      [localizedText]
    );
    const summaryBullets = useMemo(
      () => getSummaryBullets(localizedText, 1),
      [localizedText]
    );

    const whyItMatters =
      importanceBullets.length > 0
        ? importanceBullets
        : summaryBullets.length > 0
        ? summaryBullets
        : [];

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

    const whyPreview = whyItMatters.join(' ');

    return (
      <article
        ref={ref}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className={`group relative snap-start overflow-hidden rounded-3xl border border-black/5 bg-white shadow-lg shadow-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-white/10 dark:bg-gray-900 dark:shadow-none ${className ?? ''}`}
      >
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.4em] text-gray-500">
            <span>{article.source}</span>
            <time>{formatDate(article.published_date)}</time>
          </div>
          <div>
            <h2 className="text-xl font-semibold leading-snug text-gray-900 dark:text-white">
              {localizedTitle}
            </h2>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gray-500">
              Why it matters
            </p>
            <p className="text-sm leading-relaxed text-gray-700 line-clamp-2 dark:text-gray-200">
              {whyPreview || 'A short update worth your attention.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {article.metadata.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagSelect?.(tag)}
                className={`blog-tag text-xs font-semibold transition hover:brightness-95 ${getTagClass(tag)}`}
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Link
              href={`/article/${article.id}?lang=${language}`}
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:-translate-y-[1px] hover:shadow-md"
            >
              Read more →
            </Link>
          </div>
        </div>
      </article>
    );
  }
);
