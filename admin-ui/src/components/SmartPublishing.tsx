import React, { useState } from 'react';

interface Article {
  id: string;
  title: string;
  status: 'pending' | 'approved' | 'staged' | 'published' | 'rejected';
  publishing: {
    staged_at?: number;
    staged_by?: string;
    published_at?: number;
    published_by?: string;
    staging_url?: string;
    production_url?: string;
    version: number;
  };
}

interface SmartPublishingProps {
  article: Article;
  onStatusChange: () => void;
}

export function SmartPublishing({ article, onStatusChange }: SmartPublishingProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishToStaging = async () => {
    setIsPublishing(true);
    setError(null);
    
    try {
      const response = await fetch(`/admin/articles/${article.id}/publish-staging`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to publish to staging');
      
      const data = await response.json();
      
      // Show success message with staging URL
      alert(`✅ Published to staging!\n\nPreview: ${data.staging_url}`);
      
      // Open staging URL in new tab
      if (data.staging_url) {
        window.open(data.staging_url, '_blank');
      }
      
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const publishToProduction = async () => {
    if (!confirm('🚀 Publish to production?\n\nThis will:\n- Create a backup of current production\n- Promote staging to production\n- Invalidate CloudFront cache\n\nContinue?')) {
      return;
    }
    
    setIsPublishing(true);
    setError(null);
    
    try {
      const response = await fetch(`/admin/articles/${article.id}/publish-production`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to publish to production');
      
      const data = await response.json();
      
      alert(`✅ Published to production!\n\nVersion: ${data.version}\nURL: ${data.production_url}`);
      
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="smart-publishing">
      <h3>Smart Publishing</h3>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      <div className="publishing-status">
        <div className="status-badge" data-status={article.status}>
          {article.status.toUpperCase()}
        </div>
        
        {article.publishing.version > 0 && (
          <div className="version-info">
            Version: {article.publishing.version}
          </div>
        )}
      </div>
      
      <div className="publishing-actions">
        {article.status === 'approved' && (
          <button
            onClick={publishToStaging}
            disabled={isPublishing}
            className="btn btn-primary"
          >
            📝 Publish to Staging
          </button>
        )}
        
        {article.status === 'staged' && (
          <>
            <a
              href={article.publishing.staging_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              👁️ Preview Staging
            </a>
            
            <button
              onClick={publishToProduction}
              disabled={isPublishing}
              className="btn btn-success"
            >
              🚀 Publish to Production
            </button>
          </>
        )}
        
        {article.status === 'published' && article.publishing.production_url && (
          <a
            href={article.publishing.production_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            🌐 View Live Article
          </a>
        )}
      </div>
      
      {article.publishing.staged_at && (
        <div className="publishing-metadata">
          <p>
            <strong>Staged:</strong>{' '}
            {new Date(article.publishing.staged_at * 1000).toLocaleString()}
            {article.publishing.staged_by && ` by ${article.publishing.staged_by}`}
          </p>
        </div>
      )}
      
      {article.publishing.published_at && (
        <div className="publishing-metadata">
          <p>
            <strong>Published:</strong>{' '}
            {new Date(article.publishing.published_at * 1000).toLocaleString()}
            {article.publishing.published_by && ` by ${article.publishing.published_by}`}
          </p>
        </div>
      )}
      
      <style jsx>{`
        .smart-publishing {
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 1rem 0;
        }
        
        .publishing-status {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.875rem;
        }
        
        .status-badge[data-status="pending"] {
          background: #fef3c7;
          color: #92400e;
        }
        
        .status-badge[data-status="approved"] {
          background: #dbeafe;
          color: #1e40af;
        }
        
        .status-badge[data-status="staged"] {
          background: #e0e7ff;
          color: #4338ca;
        }
        
        .status-badge[data-status="published"] {
          background: #d1fae5;
          color: #065f46;
        }
        
        .version-info {
          color: #6b7280;
          font-size: 0.875rem;
        }
        
        .publishing-actions {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        
        .btn-secondary {
          background: #6b7280;
          color: white;
        }
        
        .btn-success {
          background: #10b981;
          color: white;
        }
        
        .publishing-metadata {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          font-size: 0.875rem;
          color: #6b7280;
        }
        
        .alert {
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }
        
        .alert-error {
          background: #fee2e2;
          color: #991b1b;
        }
      `}</style>
    </div>
  );
}
