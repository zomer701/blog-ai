/**
 * API client with authentication
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

export interface Article {
  id: string;
  source: string;
  source_url: string;
  title: string;
  author: string;
  published_date: string;
  scraped_at: number;
  status: string;
  content: {
    original_html: string;
    text: string;
    images: string[];
  };
  translations?: {
    es: Translation;
    uk: Translation;
  };
  metadata: {
    word_count: number;
    reading_time: string;
    tags: string[];
  };
}

export interface Translation {
  title: string;
  content: string;
  edited: boolean;
  edited_at?: number;
}

class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = API_URL;
    this.apiKey = API_KEY;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-API-Key': this.apiKey }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all published articles
   */
  async getArticles(): Promise<Article[]> {
    return this.request<Article[]>('/articles');
  }

  /**
   * Get a single article by ID
   */
  async getArticle(id: string): Promise<Article> {
    return this.request<Article>(`/articles/${id}`);
  }

  /**
   * Search articles
   */
  async searchArticles(query: string): Promise<Article[]> {
    return this.request<Article[]>(`/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Track article view (analytics)
   */
  async trackView(articleId: string): Promise<void> {
    try {
      await this.request('/analytics/track', {
        method: 'POST',
        body: JSON.stringify({
          article_id: articleId,
          event_type: 'view',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      // Don't fail if analytics tracking fails
      console.error('Failed to track view:', error);
    }
  }
}

export const api = new ApiClient();
