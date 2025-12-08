'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Article } from '@/lib/api';
import { ArticleCard } from '../components/feed/ArticleCard';
import { TopNav, Category } from '../components/feed/TopNav';
import { Articles } from '../lib/storageData';

const PAGE_SIZE = 15;

type Language = 'en' | 'es' | 'uk';

const LANGS: Language[] = ['en', 'es', 'uk'];

const getPathLanguage = (): Language | null => {
  if (typeof window === 'undefined') return null;
  const parts = window.location.pathname.split('/').filter(Boolean);
  const candidate = parts[0]?.toLowerCase();
  return LANGS.includes(candidate as Language) ? (candidate as Language) : null;
};

const getCookieLanguage = (): Language | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )preferred_lang=([^;]+)/);
  const value = match ? decodeURIComponent(match[1]) : null;
  return LANGS.includes(value as Language) ? (value as Language) : null;
};

const setCookieLanguage = (lang: Language) => {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `preferred_lang=${encodeURIComponent(
    lang
  )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
};

export default function Home() {
  const articles: Article[] = Articles;
  const [language, setLanguage] = useState<Language>('en');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [page, setPage] = useState(0);

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const initialLang =
      getPathLanguage() ?? getCookieLanguage() ?? ('en' as Language);
    if (initialLang !== language) {
      setLanguage(initialLang);
      setCookieLanguage(initialLang);
    } else {
      setCookieLanguage(initialLang);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories: Category[] = useMemo(() => {
    if (!articles.length) return [];

    const normalizeTag = (value: string) => value.replace(/^#/, '').toLowerCase();

    const tagCounts = new Map<string, { count: number; label: string }>();
    const sourceCounts = new Map<string, number>();

    articles.forEach((article) => {
      sourceCounts.set(article.source, (sourceCounts.get(article.source) || 0) + 1);
      article.metadata.tags.forEach((tag) => {
        const key = normalizeTag(tag);
        if (!tagCounts.has(key)) {
          tagCounts.set(key, { count: 0, label: tag });
        }
        const current = tagCounts.get(key)!;
        tagCounts.set(key, { count: current.count + 1, label: current.label });
      });
    });

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([id, info]) => ({
        id,
        label: info.label.startsWith('#') ? info.label : info.label,
        count: info.count,
      }));

    const topSources = [...sourceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({ id, label: id, count }));

    return [
      { id: 'all', label: 'All stories', count: articles.length },
      ...topTags,
      ...topSources,
    ];
  }, [articles]);

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return articles;
    return articles.filter((article) => {
      const matchesTag = article.metadata.tags.includes(activeCategory);
      const matchesSource = article.source === activeCategory;
      return matchesTag || matchesSource;
    });
  }, [activeCategory, articles]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const visibleArticles = filtered.slice(start, end);

  const handleSwipe = (direction: 'up' | 'down', currentIndex: number) => {
    const targetIndex =
      direction === 'up' ? currentIndex + 1 : Math.max(currentIndex - 1, 0);
    const target = cardRefs.current[targetIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (direction === 'up' && currentPage < totalPages - 1) {
      setPage((p) => Math.min(p + 1, totalPages - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (direction === 'down' && currentPage > 0) {
      setPage((p) => Math.max(p - 1, 0));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <TopNav
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={(id) => {
          setActiveCategory(id);
          setPage(0);
        }}
        language={language}
        onLanguageChange={(lang) => {
          setLanguage(lang);
          setCookieLanguage(lang);
        }}
      />

      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-6 snap-y snap-mandatory overflow-y-auto max-h-[calc(100vh-88px)] sm:px-6 lg:max-h-none lg:overflow-visible lg:pt-10 lg:[scroll-snap-type:none]">
        {visibleArticles.length === 0 && (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm dark:border-white/10 dark:bg-gray-900 dark:text-gray-300">
            No stories found for this category.
          </div>
        )}

        <div className="grid snap-y snap-mandatory gap-6 lg:grid-cols-2 lg:[scroll-snap-type:none] xl:grid-cols-3">
          {visibleArticles.map((article, index) => (
            <ArticleCard
              key={article.id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              article={article}
              language={language}
              onSwipe={(direction) => handleSwipe(direction, index)}
            />
          ))}
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setPage((p) => Math.max(p - 1, 0));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === 0}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                currentPage === 0
                  ? 'cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              ← Prev
            </button>
            <span className="text-sm font-semibold text-gray-600">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => {
                setPage((p) => Math.min(p + 1, totalPages - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage >= totalPages - 1}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                currentPage >= totalPages - 1
                  ? 'cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
