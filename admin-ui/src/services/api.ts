import axios from 'axios';
import { Article, SearchQuery, SearchResults, AnalyticsEvent, ArticleStats, PopularArticle, DashboardStats } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add JWT token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Articles API
export const articlesApi = {
    list: () => api.get<Article[]>('/admin/articles'),
    get: (id: string) => api.get<Article>(`/admin/articles/${id}`),
    update: (id: string, data: Partial<Article>) => api.put<Article>(`/admin/articles/${id}`, data),
    publish: (id: string) => api.post(`/admin/articles/${id}/publish`),
    unpublish: (id: string) => api.post(`/admin/articles/${id}/unpublish`),
    delete: (id: string) => api.delete(`/admin/articles/${id}`),
};

// Search API
export const searchApi = {
    search: (query: SearchQuery) => api.get<SearchResults>('/api/search', { params: query }),
};

// Analytics API
export const analyticsApi = {
    track: (event: AnalyticsEvent) => api.post('/api/analytics/track', event),
    getArticleStats: (id: string) => api.get<ArticleStats>(`/api/analytics/articles/${id}`),
    getPopular: (days: number = 7) => api.get<PopularArticle[]>(`/api/analytics/popular?days=${days}`),
    getDashboard: () => api.get<DashboardStats>('/api/analytics/dashboard'),
};

export default api;
