'use client';
/* eslint-disable @next/next/no-img-element */

import { memo } from 'react';

export type Category = {
  id: string;
  label: string;
  count: number;
};

type Language = 'en' | 'es' | 'uk';
type TopNavProps = {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
};

const languages: { label: string; value: Language }[] = [
  { label: 'EN', value: 'en' },
  { label: 'ES', value: 'es' },
  { label: 'UK', value: 'uk' },
];

export const TopNav = memo(function TopNav({
  categories,
  activeCategory,
  onCategoryChange,
  language,
  onLanguageChange,
}: TopNavProps) {
  return (
    <div className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <img
            src="/icon.png"
            alt="GenAI Agent News"
            className="h-10 w-10 rounded-xl border border-black/5 bg-white object-cover shadow-md"
          />
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-600">
            GenAI Agent News
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-gray-100/80 px-2 py-1 text-sm text-gray-700 shadow-inner">
            {languages.map((lang) => (
              <button
                key={lang.value}
                onClick={() => onLanguageChange(lang.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                  language === lang.value
                    ? 'bg-white text-gray-900 shadow'
                    : 'hover:bg-white'
                }`}
              >
                {lang.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

        <div className="no-scrollbar overflow-x-auto border-t border-black/5 px-4 py-2 text-sm text-gray-700 sm:px-6">
          <div className="flex items-center gap-2">
            {categories.map((category) => {
              const isActive = category.id === activeCategory;
              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.id)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'border-gray-900 bg-gray-900 text-white shadow'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {category.label}
                  <span className="ml-2 rounded-full bg-black/5 px-2 py-[2px] text-[11px] font-semibold">
                    {category.count}
                  </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
