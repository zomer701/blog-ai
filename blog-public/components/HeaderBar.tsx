'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { LANGUAGES, type Language } from '@/lib/articleUtils';

type HeaderBarProps = {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  className?: string;
  onBack?: () => void;
};

export function HeaderBar({
  language,
  onLanguageChange,
  className = '',
  onBack,
}: HeaderBarProps) {
  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.assign('/');
  };

  return (
    <div className={`bg-white/90 backdrop-blur ${className}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            prefetch={false}
            onClick={handleBrandClick}
            className="inline-flex items-center gap-3"
          >
            <Image
              src="/icon.png"
              width={40}
              height={40}
              alt="GenAI Agent News"
              className="rounded-xl border border-black/10 bg-white object-cover"
            />
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-600">
              GenAI Agent News
            </span>
            {onBack && (
              <span className="rounded-full border border-gray-200 bg-white px-3 py-2 text-lg font-semibold text-gray-600 shadow-sm">
                ←
              </span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-gray-100/80 px-2 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-gray-700 shadow-inner">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => onLanguageChange(lang)}
                className={`rounded-full px-3 py-1 transition ${
                  language === lang
                    ? 'bg-white text-gray-900 shadow'
                    : 'hover:bg-white/80'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
