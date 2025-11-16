// Type definitions for the admin UI

export interface Article {
    id: string;
    url: string;
    title: string;
    content: string;
    published_at: string;
    source: string;
    title_es: string;
    content_es: string;
    title_uk: string;
    content_uk: string;
    title_es_edited: boolean;
    content_es_edited: boolean;
    title_uk_edited: boolean;
    content_uk_edited: boolean;
    status: 'scraped' | 'translated' | 'published';
    created_at: string;
    updated_at: string;
}

export interface SearchQuery {
    text?: string;
    source?: string;
    date_from?: string;
    date_to?: string;
    language?: string;
    status?: string;
}

export interface SearchResults {
    articles: Article[];
    total: number;
    page: number;
    per_page: number;
}

export interface AnalyticsEvent {
    article_id: string;
    event_type: 'view' | 'click' | 'share';
    timestamp: string;
    user_agent?: string;
    referrer?: string;
    country?: string;
    device_type?: string;
}

export interface ArticleStats {
    article_id: string;
    total_views: number;
    unique_visitors: number;
    avg_time_on_page: number;
    views_by_day: { date: string; views: number }[];
}

export interface PopularArticle {
    article_id: string;
    title: string;
    views: number;
    source: string;
}

export interface DashboardStats {
    total_articles: number;
    published_articles: number;
    pending_articles: number;
    total_views: number;
    views_today: number;
    popular_articles: PopularArticle[];
}

export interface User {
    email: string;
    name: string;
    token: string;
}
