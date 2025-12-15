'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { api, type Article } from '@/lib/api';
import {
  formatTagLabel,
  getImportanceBullets,
  getLocalizedLabel,
  getLocalizedText,
  getLocalizedTitle,
  getSummaryBullets,
  getWatchNextBullets,
  type Language,
  LANGUAGES,
} from '@/lib/articleUtils';
import { HeaderBar } from '@/components/HeaderBar';

const COOKIE_NAME = 'preferred_lang';

const normalizeLanguage = (value?: string): Language | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return LANGUAGES.includes(normalized as Language)
    ? (normalized as Language)
    : null;
};

const getLanguageFromSearchParam = (): Language | null => {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  return normalizeLanguage(url.searchParams.get('lang') ?? undefined);
};

const getLanguageFromCookie = (): Language | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((segment) => segment.trim())
    .find((segment) => segment.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const rawValue = match.substring(COOKIE_NAME.length + 1);
  return normalizeLanguage(decodeURIComponent(rawValue));
};

type Props = {
  article: Article;
  initialLanguage: Language;
};

const TAG_GRADIENTS: Record<string, string> = {
  openai: 'linear-gradient(135deg, rgba(16,163,127,0.15) 0%, rgba(14,165,233,0.05) 100%)',
  anthropic: 'linear-gradient(135deg, rgba(217,119,87,0.18) 0%, rgba(79,70,229,0.05) 100%)',
  arxiv: 'linear-gradient(135deg, rgba(179,27,27,0.18) 0%, rgba(251,191,36,0.08) 100%)',
  deepmind: 'linear-gradient(135deg, rgba(66,133,244,0.18) 0%, rgba(15,23,42,0.03) 100%)',
  nvidia: 'linear-gradient(135deg, rgba(118,185,0,0.18) 0%, rgba(15,23,42,0.03) 100%)',
  meta: 'linear-gradient(135deg, rgba(0,100,224,0.18) 0%, rgba(15,23,42,0.03) 100%)',
  huggingface: 'linear-gradient(135deg, rgba(255,210,30,0.18) 0%, rgba(15,23,42,0.03) 100%)',
  scale: 'linear-gradient(135deg, rgba(0,0,0,0.18) 0%, rgba(15,23,42,0.03) 100%)',
};

const getTagGradient = (tags: string[]): string => {
  const normalized = tags
    .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
    .find((value) => value && TAG_GRADIENTS[value]);
  return normalized ? TAG_GRADIENTS[normalized] : TAG_GRADIENTS.openai;
};

export function ArticlePageClient({ article, initialLanguage }: Props) {
  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }, []);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [languageReady, setLanguageReady] = useState(false);
  const [shareUrl] = useState(article.source_url);
  const [copied, setCopied] = useState(false);

  useLayoutEffect(() => {
    const preferredLanguage =
      getLanguageFromSearchParam() ??
      getLanguageFromCookie() ??
      initialLanguage;
    setLanguage(preferredLanguage);
    setLanguageReady(true);
  }, [initialLanguage]);

  const setCookieLanguage = useCallback((lang: Language) => {
    if (typeof document === 'undefined') return;
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `preferred_lang=${encodeURIComponent(
      lang
    )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }, []);

  useEffect(() => {
    setCookieLanguage(language);
  }, [language, setCookieLanguage]);

  useEffect(() => {
    api.trackView(article.id);
  }, [article.id]);

  const effectiveLanguage = language ?? initialLanguage;
  const whyItMattersLabel = getLocalizedLabel('whyItMatters', effectiveLanguage);
  const watchNextLabel = getLocalizedLabel('watchNext', effectiveLanguage);
  const updatedLabel = getLocalizedLabel('updated', effectiveLanguage);

  const localizedTitle = useMemo(
    () => getLocalizedTitle(article, effectiveLanguage),
    [article, effectiveLanguage]
  );
  const localizedText = useMemo(
    () => getLocalizedText(article, effectiveLanguage),
    [article, effectiveLanguage]
  );

  const summaryBullets = useMemo(() => {
    const generated = getSummaryBullets(localizedText, 5);
    if (generated.length) {
      return generated;
    }
    const fallback = localizedText
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    return fallback ? [fallback] : ['Summary unavailable.'];
  }, [localizedText]);

  const importanceBullets = useMemo(
    () => getImportanceBullets(localizedText, 3),
    [localizedText]
  );

  const watchNextBullets = useMemo(
    () => getWatchNextBullets(localizedText, article, effectiveLanguage, 2),
    [localizedText, article, effectiveLanguage]
  );

  const effectiveShareUrl = shareUrl || article.source_url;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
    effectiveShareUrl
  )}&text=${encodeURIComponent(localizedTitle)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${localizedTitle} ${effectiveShareUrl}`
  )}`;

  const handleCopyLink = useCallback(async () => {
    const urlToCopy = effectiveShareUrl;
    if (!urlToCopy || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed', error);
    }
  }, [effectiveShareUrl]);

  const changeLanguage = useCallback(
    (newLang: Language) => {
      setLanguage(newLang);
      setCookieLanguage(newLang);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', newLang);
        window.history.replaceState({}, '', url);
      }
    },
    [setCookieLanguage]
  );

  const articleGradient = useMemo(
    () => getTagGradient(article.metadata.tags ?? []),
    [article.metadata.tags]
  );

  const formattedDate = useMemo(() => {
    try {
      return new Date(article.published_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return article.published_date;
    }
  }, [article.published_date]);

  if (!languageReady) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900" />
    );
  }

  return (
    <div
      className="min-h-screen text-gray-900"
      style={{
        backgroundColor: '#f9fafb',
        backgroundImage: articleGradient,
      }}
    >
      <HeaderBar
        className="sticky top-0 z-30 border-b border-gray-200"
        language={language}
        onLanguageChange={changeLanguage}
        onBack={handleBack}
      />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="space-y-2 text-[11px] uppercase tracking-[0.3em] text-gray-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-900 px-3 py-1 text-[10px] font-semibold text-white shadow-inner">
                30 sec read
              </span>
              <span className="text-gray-600">{updatedLabel} {formattedDate}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-600">Source:</span>
              <span className="rounded-full border border-gray-200 px-3 py-1 text-[10px] font-semibold text-gray-700">
                {article.source}
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-semibold leading-snug text-gray-900">
            {localizedTitle}
          </h1>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-gray-500">
                TL;DR
              </p>
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                {summaryBullets.length} bullet
                {summaryBullets.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="mt-3 space-y-3 text-sm text-gray-700">
              {summaryBullets.map((bullet, index) => (
                <li key={`${bullet}-${index}`} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gray-900" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 shadow-sm">
            <span>Share</span>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-black transition hover:text-gray-700 focus:outline-none"
              >
                {copied ? 'Link copied' : 'Copy link'}
              </button>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#2aabee] bg-[#2aabee] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-[#2294d6]"
              >
                Telegram
              </a>
              <a
                href={twitterUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:-translate-y-[1px] hover:bg-neutral-900"
              >
                X
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                  effectiveShareUrl
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#1877f2] bg-[#1877f2] px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-[#165ecb]"
              >
                Facebook
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Topics:</span>
            <span className="text-gray-600">
              {article.metadata.tags.length > 0
                ? article.metadata.tags
                    .map((tag) => formatTagLabel(tag))
                    .join(' · ')
                : 'General'}
            </span>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.4em] text-gray-500">
            {whyItMattersLabel}
          </div>
          <ul className="space-y-3 text-sm text-gray-700">
            {(importanceBullets.length ? importanceBullets : [
              'The implications are still unfolding.',
            ]).map((bullet, index) => (
              <li key={`${bullet}-${index}`} className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gray-900" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.4em] text-gray-500">
            {watchNextLabel}
          </div>
          <ul className="space-y-3 text-sm text-gray-700">
            {watchNextBullets.map((bullet, index) => (
              <li
                key={`${bullet.text}-${index}`}
                className="flex gap-3"
              >
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gray-900" />
                {bullet.href ? (
                  <Link
                    href={bullet.href}
                    className="text-sm font-semibold text-blue-700 underline"
                  >
                    {bullet.text}
                  </Link>
                ) : (
                  <span>{bullet.text}</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.4em] text-gray-500">
            Source
          </div>
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-800"
          >
            {article.source} ↗
          </a>
          <p className="text-xs text-gray-400">{article.source_url}</p>
        </section>
      </main>
    </div>
  );
}
