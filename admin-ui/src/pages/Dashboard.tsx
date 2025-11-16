import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { analyticsApi, articlesApi } from '../services/api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => analyticsApi.getDashboard(),
    });

    const { data: articles, isLoading: articlesLoading } = useQuery({
        queryKey: ['recent-articles'],
        queryFn: () => articlesApi.list(),
    });

    if (statsLoading || articlesLoading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    const recentArticles = articles?.data.slice(0, 5) || [];

    return (
        <div className="dashboard">
            <h2>Dashboard Overview</h2>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.data.total_articles || 0}</div>
                        <div className="stat-label">Total Articles</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.data.published_articles || 0}</div>
                        <div className="stat-label">Published</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">⏳</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.data.pending_articles || 0}</div>
                        <div className="stat-label">Pending Review</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon">👁️</div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.data.total_views || 0}</div>
                        <div className="stat-label">Total Views</div>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-section">
                    <h3>Recent Articles</h3>
                    <div className="articles-list">
                        {recentArticles.map((article) => (
                            <Link
                                key={article.id}
                                to={`/articles/${article.id}`}
                                className="article-item"
                            >
                                <div className="article-info">
                                    <div className="article-title">{article.title}</div>
                                    <div className="article-meta">
                                        {article.source} • {new Date(article.published_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <span className={`status-badge ${article.status}`}>
                                    {article.status}
                                </span>
                            </Link>
                        ))}
                    </div>
                    <Link to="/articles" className="view-all-link">
                        View all articles →
                    </Link>
                </div>

                <div className="dashboard-section">
                    <h3>Popular Articles</h3>
                    <div className="popular-list">
                        {stats?.data.popular_articles?.slice(0, 5).map((article, index) => (
                            <div key={article.article_id} className="popular-item">
                                <div className="popular-rank">#{index + 1}</div>
                                <div className="popular-info">
                                    <div className="popular-title">{article.title}</div>
                                    <div className="popular-views">{article.views} views</div>
                                </div>
                            </div>
                        )) || <div className="no-data">No analytics data yet</div>}
                    </div>
                </div>
            </div>

            <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="actions-grid">
                    <Link to="/articles" className="action-card">
                        <span className="action-icon">📝</span>
                        <span className="action-label">Manage Articles</span>
                    </Link>
                    <Link to="/analytics" className="action-card">
                        <span className="action-icon">📊</span>
                        <span className="action-label">View Analytics</span>
                    </Link>
                    <Link to="/settings" className="action-card">
                        <span className="action-icon">⚙️</span>
                        <span className="action-label">Settings</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
