import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';

const Analytics: React.FC = () => {
    const { data: popular } = useQuery({
        queryKey: ['popular-articles'],
        queryFn: () => analyticsApi.getPopular(30),
    });

    const { data: dashboard } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => analyticsApi.getDashboard(),
    });

    // Mock data for charts (replace with real data from API)
    const viewsData = [
        { date: 'Mon', views: 120 },
        { date: 'Tue', views: 150 },
        { date: 'Wed', views: 180 },
        { date: 'Thu', views: 160 },
        { date: 'Fri', views: 200 },
        { date: 'Sat', views: 140 },
        { date: 'Sun', views: 110 },
    ];

    const popularData = popular?.data?.slice(0, 10).map((article, index) => ({
        name: article.title.substring(0, 30) + '...',
        views: article.views,
    })) || [];

    return (
        <div className="analytics-page">
            <h2>Analytics Dashboard</h2>

            <div className="analytics-stats">
                <div className="stat-card">
                    <div className="stat-label">Total Views</div>
                    <div className="stat-value">{dashboard?.data.total_views || 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Views Today</div>
                    <div className="stat-value">{dashboard?.data.views_today || 0}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Published Articles</div>
                    <div className="stat-value">{dashboard?.data.published_articles || 0}</div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-card">
                    <h3>Views Over Time</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={viewsData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="views" stroke="#667eea" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <h3>Popular Articles</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={popularData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="views" fill="#10b981" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="popular-articles-list">
                <h3>Top Articles (Last 30 Days)</h3>
                <div className="popular-table">
                    {popular?.data?.slice(0, 10).map((article, index) => (
                        <div key={article.article_id} className="popular-row">
                            <div className="rank">#{index + 1}</div>
                            <div className="article-info">
                                <div className="article-title">{article.title}</div>
                                <div className="article-source">{article.source}</div>
                            </div>
                            <div className="views-count">{article.views} views</div>
                        </div>
                    )) || <div className="no-data">No analytics data available yet</div>}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
