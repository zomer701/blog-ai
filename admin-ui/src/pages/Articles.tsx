import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { articlesApi } from '../services/api';
import { Article } from '../types';
import './Articles.css';

const Articles: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const queryClient = useQueryClient();

    const { data: articles, isLoading } = useQuery({
        queryKey: ['articles'],
        queryFn: () => articlesApi.list(),
    });

    const publishMutation = useMutation({
        mutationFn: (id: string) => articlesApi.publish(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['articles'] });
        },
    });

    const unpublishMutation = useMutation({
        mutationFn: (id: string) => articlesApi.unpublish(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['articles'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => articlesApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['articles'] });
        },
    });

    if (isLoading) {
        return <div className="loading">Loading articles...</div>;
    }

    const filteredArticles = articles?.data.filter((article: Article) => {
        const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
        const matchesSource = sourceFilter === 'all' || article.source === sourceFilter;
        return matchesSearch && matchesStatus && matchesSource;
    }) || [];

    const sources = Array.from(new Set(articles?.data.map((a: Article) => a.source) || []));

    const handlePublish = (id: string) => {
        if (window.confirm('Publish this article?')) {
            publishMutation.mutate(id);
        }
    };

    const handleUnpublish = (id: string) => {
        if (window.confirm('Unpublish this article?')) {
            unpublishMutation.mutate(id);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Delete this article? This action cannot be undone.')) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <div className="articles-page">
            <div className="page-header">
                <h2>Articles</h2>
                <div className="header-stats">
                    <span>{filteredArticles.length} articles</span>
                </div>
            </div>

            <div className="filters-bar">
                <input
                    type="text"
                    placeholder="Search articles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="all">All Status</option>
                    <option value="scraped">Scraped</option>
                    <option value="translated">Translated</option>
                    <option value="published">Published</option>
                </select>

                <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="filter-select"
                >
                    <option value="all">All Sources</option>
                    {sources.map((source) => (
                        <option key={source} value={source}>
                            {source}
                        </option>
                    ))}
                </select>
            </div>

            <div className="articles-table-container">
                <table className="articles-table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Source</th>
                            <th>Status</th>
                            <th>Published Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredArticles.map((article: Article) => (
                            <tr key={article.id}>
                                <td>
                                    <Link to={`/articles/${article.id}`} className="article-link">
                                        {article.title}
                                    </Link>
                                </td>
                                <td>{article.source}</td>
                                <td>
                                    <span className={`status-badge ${article.status}`}>
                                        {article.status}
                                    </span>
                                </td>
                                <td>{new Date(article.published_at).toLocaleDateString()}</td>
                                <td>
                                    <div className="action-buttons">
                                        <Link to={`/articles/${article.id}`} className="btn-edit">
                                            Edit
                                        </Link>
                                        {article.status === 'published' ? (
                                            <button
                                                onClick={() => handleUnpublish(article.id)}
                                                className="btn-unpublish"
                                            >
                                                Unpublish
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handlePublish(article.id)}
                                                className="btn-publish"
                                            >
                                                Publish
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(article.id)}
                                            className="btn-delete"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredArticles.length === 0 && (
                    <div className="no-results">
                        No articles found matching your filters.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Articles;
