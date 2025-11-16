import React, { useState, useEffect } from 'react';

interface BackupInfo {
  timestamp: string;
  path: string;
  created_at: number;
}

export function RollbackPanel() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/admin/backups', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load backups');
      
      const data = await response.json();
      setBackups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const rollback = async (timestamp?: string) => {
    const message = timestamp
      ? `⏮️ Rollback to version from ${timestamp}?\n\nThis will restore the entire production site to this backup.`
      : '⏮️ Rollback to latest backup?\n\nThis will restore the entire production site to the most recent backup.';
    
    if (!confirm(message)) {
      return;
    }
    
    setIsRollingBack(true);
    setError(null);
    
    try {
      const url = timestamp
        ? `/admin/rollback?timestamp=${encodeURIComponent(timestamp)}`
        : '/admin/rollback';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Rollback failed');
      
      alert('✅ Rollback successful!\n\nProduction site has been restored.');
      
      // Reload backups list
      loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setIsRollingBack(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="rollback-panel">
      <div className="panel-header">
        <h2>🔄 Version History & Rollback</h2>
        <button onClick={loadBackups} className="btn-refresh" disabled={loading}>
          ↻ Refresh
        </button>
      </div>
      
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      <div className="quick-rollback">
        <button
          onClick={() => rollback()}
          disabled={isRollingBack || backups.length === 0}
          className="btn btn-warning"
        >
          ⏮️ Rollback to Latest Backup
        </button>
        <p className="help-text">
          Instantly restore production to the most recent backup
        </p>
      </div>
      
      <div className="backups-section">
        <h3>Available Backups ({backups.length})</h3>
        
        {loading ? (
          <div className="loading">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="empty-state">
            No backups available yet. Backups are created automatically when you publish to production.
          </div>
        ) : (
          <div className="backups-list">
            {backups.map((backup, index) => (
              <div key={backup.timestamp} className="backup-item">
                <div className="backup-info">
                  <div className="backup-timestamp">
                    {backup.timestamp}
                    {index === 0 && <span className="badge-latest">Latest</span>}
                  </div>
                  <div className="backup-date">
                    {formatDate(backup.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => rollback(backup.timestamp)}
                  disabled={isRollingBack}
                  className="btn btn-sm btn-warning"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="info-box">
        <h4>ℹ️ About Backups</h4>
        <ul>
          <li>Backups are created automatically before each production publish</li>
          <li>Backups are retained for 30 days</li>
          <li>Rollback restores the entire production site instantly</li>
          <li>CloudFront cache is automatically invalidated after rollback</li>
        </ul>
      </div>
      
      <style jsx>{`
        .rollback-panel {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 2rem;
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        
        .panel-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }
        
        .btn-refresh {
          padding: 0.5rem 1rem;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
        }
        
        .btn-refresh:hover:not(:disabled) {
          background: #e5e7eb;
        }
        
        .btn-refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .quick-rollback {
          background: #fef3c7;
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 2rem;
        }
        
        .quick-rollback .btn {
          margin-bottom: 0.5rem;
        }
        
        .help-text {
          margin: 0;
          color: #92400e;
          font-size: 0.875rem;
        }
        
        .backups-section {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        
        .backups-section h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.125rem;
        }
        
        .loading, .empty-state {
          text-align: center;
          padding: 2rem;
          color: #6b7280;
        }
        
        .backups-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .backup-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }
        
        .backup-info {
          flex: 1;
        }
        
        .backup-timestamp {
          font-weight: 600;
          font-family: monospace;
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .badge-latest {
          background: #10b981;
          color: white;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-family: system-ui;
        }
        
        .backup-date {
          color: #6b7280;
          font-size: 0.875rem;
        }
        
        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          font-size: 1rem;
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-warning {
          background: #f59e0b;
          color: white;
        }
        
        .btn-warning:hover:not(:disabled) {
          background: #d97706;
        }
        
        .btn-sm {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }
        
        .info-box {
          background: #eff6ff;
          padding: 1.5rem;
          border-radius: 8px;
          border-left: 4px solid #2563eb;
        }
        
        .info-box h4 {
          margin-top: 0;
          margin-bottom: 0.75rem;
          color: #1e40af;
        }
        
        .info-box ul {
          margin: 0;
          padding-left: 1.5rem;
          color: #1e40af;
        }
        
        .info-box li {
          margin-bottom: 0.5rem;
        }
        
        .alert {
          padding: 1rem;
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
