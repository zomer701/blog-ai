'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Article } from '@/lib/api';

export default function ArticlePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'es' | 'uk'>(
    (searchParams.get('lang') as 'en' | 'es' | 'uk') || 'en'
  );

  useEffect(() => {
    loadArticle();
  }, [params.id]);

  useEffect(() => {
    if (article) {
      api.trackView(article.id);
    }
  }, [article]);

  const loadArticle = async () => {
    try {
      setLoading(true);
      const data = await api.getArticle(params.id as string);
      setArticle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = (newLang: 'en' | 'es' | 'uk') => {
    setLanguage(newLang);
    router.push(`/article/${params.id}?lang=${newLang}`);
  };

  const getTitle = () => {
    if (!article) return '';
    if (language === 'en') return article.title;
    if (language === 'es' && article.translations?.es) {
      return article.translations.es.title;
    }
    if (language === 'uk' && article.translations?.uk) {
      return article.translations.uk.title;
    }
    return article.title;
  };

  const getContent = () => {
    if (!article) return '';
    if (language === 'en') return article.content.text;
    if (language === 'es' && article.translations?.es) {
      return article.translations.es.content;
    }
    if (language === 'uk' && article.translations?.uk) {
      return article.translations.uk.content;
    }
    return article.content.text;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <p className="font-medium text-red-700">Error loading article</p>
          <p className="text-sm text-red-600 mt-2">{error}</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-red-600 hover:text-red-800"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to articles
            </Link>
            
            {/* Language Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => changeLanguage('en')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => changeLanguage('es')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === 'es'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ES
              </button>
              <button
                onClick={() => changeLanguage('uk')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  language === 'uk'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                UK
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-lg shadow-md p-8">
          {/* Article Header */}
          <header className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                {article.source}
              </span>
              <span>•</span>
              <time>{formatDate(article.published_date)}</time>
              <span>•</span>
              <span>{article.metadata.reading_time}</span>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {getTitle()}
            </h1>
            
            <p className="text-lg text-gray-600">
              By {article.author}
            </p>
          </header>

          {/* Article Body */}
          <div className="prose prose-lg max-w-none">
            {getContent().split('\n\n').map((paragraph, index) => (
              <p key={index} className="mb-4 text-gray-700 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Article Footer */}
          <footer className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Read original article →
              </a>
              
              {article.metadata.tags.length > 0 && (
                <div className="flex gap-2">
                  {article.metadata.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
