import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { articlesApi } from '../services/api';
import './ArticleEdit.css';

const ArticleEdit: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: article, isLoading } = useQuery({
        queryKey: ['article', id],
        queryFn: () => articlesApi.get(id!),
        enabled: !!id,
    });

    const [titleEs, setTitleEs] = useState('');
    const [contentEs, setContentEs] = useState('');
    const [titleUk, setTitleUk] = useState('');
    const [contentUk, setContentUk] = useState('');
    const [activeTab, setActiveTab] = useState<'es' | 'uk'>('es');

    React.useEffect(() => {
        if (article?.data) {
            setTitleEs(article.data.title_es || '');
            setContentEs(article.data.content_es || '');
            setTitleUk(article.data.title_uk || '');
            setContentUk(article.data.content_uk || '');
        }
    }, [article]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => articlesApi.update(id!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['article', id] });
            queryClient.invalidateQueries({ queryKey: ['articles'] });
            alert('Article updated successfully!');
        },
    });

    const publishMutation = useMutation({
        mutationFn: () => articlesApi.publish(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['article', id] });
            alert('Article published successfully!');
            navigate('/articles');
        },
    });

    if (isLoading) {
        return <div className="loading">Loading article...</div>;
    }

    if (!article?.data) {
        return <div className="error">Article not found</div>;
    }

    const handleSave = () => {
        const updates: any = {};
        
        if (activeTab === 'es') {
            updates.title_es = titleEs;
            updates.content_es = contentEs;
            updates.title_es_edited = titleEs !== article.data.title_es;
            updates.content_es_edited = contentEs !== article.data.content_es;
        } else {
            updates.title_uk = titleUk;
            updates.content_uk = contentUk;
            updates.title_uk_edited = titleUk !== article.data.title_uk;
            updates.content_uk_edited = contentUk !== article.data.content_uk;
        }

        updateMutation.mutate(updates);
    };

    const handlePublish = () => {
        if (window.confirm('Publish this article?')) {
            publishMutation.mutate();
        }
    };

    return (
        <div className="article-edit-page">
            <div className="edit-header">
                <div>
                    <h2>Edit Article</h2>
                    <p className="article-source">{article.data.source} • {new Date(article.data.published_at).toLocaleDateString()}</p>
                </div>
                <div className="header-actions">
                    <button onClick={() => navigate('/articles')} className="btn-cancel">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="btn-save" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    {article.data.status !== 'published' && (
                        <button onClick={handlePublish} className="btn-publish" disabled={publishMutation.isPending}>
                            {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                        </button>
                    )}
                </div>
            </div>

            <div className="translation-tabs">
                <button
                    className={`tab ${activeTab === 'es' ? 'active' : ''}`}
                    onClick={() => setActiveTab('es')}
                >
                    Spanish (ES)
                    {article.data.title_es_edited && <span className="edited-badge">✏️ Edited</span>}
                </button>
                <button
                    className={`tab ${activeTab === 'uk' ? 'active' : ''}`}
                    onClick={() => setActiveTab('uk')}
                >
                    Ukrainian (UK)
                    {article.data.title_uk_edited && <span className="edited-badge">✏️ Edited</span>}
                </button>
            </div>

            <div className="editor-grid">
                <div className="editor-section">
                    <h3>Original (English)</h3>
                    <div className="readonly-content">
                        <div className="content-title">{article.data.title}</div>
                        <div className="content-body">{article.data.content}</div>
                    </div>
                </div>

                <div className="editor-section">
                    <h3>{activeTab === 'es' ? 'Spanish Translation' : 'Ukrainian Translation'}</h3>
                    <div className="editable-content">
                        <input
                            type="text"
                            value={activeTab === 'es' ? titleEs : titleUk}
                            onChange={(e) => activeTab === 'es' ? setTitleEs(e.target.value) : setTitleUk(e.target.value)}
                            placeholder="Title"
                            className="title-input"
                        />
                        <textarea
                            value={activeTab === 'es' ? contentEs : contentUk}
                            onChange={(e) => activeTab === 'es' ? setContentEs(e.target.value) : setContentUk(e.target.value)}
                            placeholder="Content"
                            rows={20}
                            className="content-textarea"
                        />
                    </div>
                </div>
            </div>

            <div className="edit-info">
                <p><strong>Status:</strong> <span className={`status-badge ${article.data.status}`}>{article.data.status}</span></p>
                <p><strong>Created:</strong> {new Date(article.data.created_at).toLocaleString()}</p>
                <p><strong>Updated:</strong> {new Date(article.data.updated_at).toLocaleString()}</p>
            </div>
        </div>
    );
};

export default ArticleEdit;
