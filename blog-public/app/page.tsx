'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Article } from '@/lib/api';

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'es' | 'uk'>('en');

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const data = await api.getArticles();
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = (article: Article) => {
    if (language === 'en') return article.title;
    if (language === 'es' && article.translations?.es) {
      return article.translations.es.title;
    }
    if (language === 'uk' && article.translations?.uk) {
      return article.translations.uk.title;
    }
    return article.title;
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">
              AI & Tech Blog
            </h1>
            
            {/* Language Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('es')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  language === 'es'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Español
              </button>
              <button
                onClick={() => setLanguage('uk')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  language === 'uk'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Українська
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading articles...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-medium">Error loading articles</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={loadArticles}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No articles found</p>
          </div>
        )}

        {!loading && !error && articles.length > 0 && (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/article/${article.id}?lang=${language}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      {article.source}
                    </span>
                    <span>•</span>
                    <time>{formatDate(article.published_date)}</time>
                  </div>
                  
                  <h2 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">
                    {getTitle(article)}
                  </h2>
                  
                  <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                    {article.content.text.substring(0, 150)}...
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{article.author}</span>
                    <span>{article.metadata.reading_time}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} AI & Tech Blog. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
