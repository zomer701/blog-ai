import React from 'react';
import { authService } from '../services/auth';
import './Settings.css';

const Settings: React.FC = () => {
    const userEmail = authService.getUserEmail();

    return (
        <div className="settings-page">
            <h2>Settings</h2>

            <div className="settings-section">
                <h3>User Information</h3>
                <div className="setting-item">
                    <label>Email</label>
                    <div className="setting-value">{userEmail}</div>
                </div>
            </div>

            <div className="settings-section">
                <h3>Application Settings</h3>
                <div className="setting-item">
                    <label>API URL</label>
                    <div className="setting-value">
                        {process.env.REACT_APP_API_URL || 'http://localhost:3000'}
                    </div>
                </div>
                <div className="setting-item">
                    <label>Version</label>
                    <div className="setting-value">1.0.0 (Phase 2)</div>
                </div>
            </div>

            <div className="settings-section">
                <h3>Features</h3>
                <div className="features-list">
                    <div className="feature-item">
                        <span className="feature-icon">✅</span>
                        <span>Article Management</span>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">✅</span>
                        <span>Translation Editor</span>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">✅</span>
                        <span>Analytics Dashboard</span>
                    </div>
                    <div className="feature-item">
                        <span className="feature-icon">✅</span>
                        <span>Search & Filters</span>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3>About</h3>
                <p>AI Blog Admin - Content Management System</p>
                <p>Built with React, TypeScript, and Rust</p>
                <p>Phase 2: Admin UI, Search, and Analytics</p>
            </div>
        </div>
    );
};

export default Settings;
