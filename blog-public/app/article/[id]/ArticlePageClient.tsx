'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Article } from '@/lib/api';

type Language = 'en' | 'es' | 'uk';

type Props = {
  id: string;
  searchParamsLang?: string;
};

export function ArticlePageClient({ id, searchParamsLang }: Props) {
  const router = useRouter();

  const [articleId, setArticleId] = useState<string | null>(id || null);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(
    (searchParamsLang as Language) || 'en'
  );

  const LANGS = useMemo(() => ['en', 'es', 'uk'] as const, []);

  const resolveId = useCallback((): string | null => {
    if (articleId) return articleId;
    if (id) return id;
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || null;
    }
    return null;
  }, [articleId, id]);

  useEffect(() => {
    const current = resolveId();
    if (current && current !== articleId) {
      setArticleId(current);
    }
  }, [articleId, resolveId]);

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

  const loadArticle = useCallback(async () => {
    const targetId = resolveId();
    if (!targetId) {
      setError('Missing article id');
      setLoading(false);
      return;
    }
    setArticleId(targetId);

    try {
      setLoading(true);
      const data = await api.getArticle(targetId);
      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  }, [resolveId]);

  useEffect(() => {
    const pathLang = getPathLanguage();
    const cookieLang = getCookieLanguage();
    const paramLang = searchParamsLang as Language | undefined;
    const nextLang = paramLang || pathLang || cookieLang || 'en';
    setLanguage(nextLang);
    setCookieLanguage(nextLang);

    loadArticle();
  }, [
    getCookieLanguage,
    getPathLanguage,
    loadArticle,
    searchParamsLang,
    setCookieLanguage,
  ]);

  useEffect(() => {
    if (article) {
      api.trackView(article.id);
    }
  }, [article]);

  const changeLanguage = (newLang: Language) => {
    const targetId = resolveId();
    if (!targetId) return;
    setLanguage(newLang);
    setCookieLanguage(newLang);
    router.push(`/article/${targetId}?lang=${newLang}`);
  };

  const getTitle = useCallback(
    (item: Article | null) => {
      if (!item) return '';
      if (language === 'es' && item.translations?.es)
        return item.translations.es.title;
      if (language === 'uk' && item.translations?.uk)
        return item.translations.uk.title;
      return item.title;
    },
    [language]
  );

  const getContent = useCallback(
    (item: Article | null) => {
      if (!item) return '';
      if (language === 'es' && item.translations?.es)
        return item.translations.es.content;
      if (language === 'uk' && item.translations?.uk)
        return item.translations.uk.content;
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

  const primaryTag = article?.metadata.tags?.[0];

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

  const heroMedia = useMemo(() => article?.content.images?.[0], [article]);
  const isVideoHero =
    !!heroMedia && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(heroMedia.split('?')[0]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 via-black to-gray-950 text-white">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-b-white" />
          <p className="mt-4 text-sm text-white/70">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <p className="text-lg font-semibold text-red-700">Error loading article</p>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 text-gray-900"
      style={{ backgroundColor: tagTint(primaryTag) }}
    >
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" aria-label="Home" className="flex items-center gap-2">
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
              {(['en', 'es', 'uk'] as const).map((lang) => (
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
        <article className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl shadow-black/10">
          <div className="relative">
            {heroMedia ? (
              isVideoHero ? (
                <video
                  src={heroMedia}
                  controls
                  playsInline
                  className="h-[48vh] w-full object-cover sm:h-[55vh]"
                />
              ) : (
                <img
                  src={heroMedia}
                  alt={article.title}
                  className="h-[48vh] w-full object-cover sm:h-[55vh]"
                  loading="lazy"
                />
              )
            ) : (
              <div className="flex h-[40vh] w-full items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-200 text-gray-400">
                No media
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 space-y-3 px-5 pb-6 sm:px-7 sm:pb-7">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-white/80">
                <span className="rounded-full bg-white/15 px-3 py-1">{article.source}</span>
                <span className="h-1 w-1 rounded-full bg-white/50" />
                <time>{formatDate(article.published_date)}</time>
                <span className="h-1 w-1 rounded-full bg-white/50" />
                <span>{article.metadata.reading_time}</span>
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {getTitle(article)}
              </h1>
              <p className="text-sm text-white/80">By {article.author}</p>
            </div>
          </div>

          <div className="grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[2fr,1fr] lg:gap-10">
            <div className="prose prose-lg max-w-none text-gray-800">
              {getContent(article)
                .split('\n\n')
                .map((paragraph, index) => (
                  <p key={index} className="leading-relaxed text-gray-800">
                    {paragraph}
                  </p>
                ))}
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
