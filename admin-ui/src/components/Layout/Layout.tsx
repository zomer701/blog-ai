import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth';
import './Layout.css';

const Layout: React.FC = () => {
    const navigate = useNavigate();
    const userEmail = authService.getUserEmail();

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>AI Blog Admin</h2>
                </div>
                <nav className="sidebar-nav">
                    <Link to="/" className="nav-item">
                        <span>📊</span> Dashboard
                    </Link>
                    <Link to="/articles" className="nav-item">
                        <span>📝</span> Articles
                    </Link>
                    <Link to="/analytics" className="nav-item">
                        <span>📈</span> Analytics
                    </Link>
                    <Link to="/settings" className="nav-item">
                        <span>⚙️</span> Settings
                    </Link>
                </nav>
            </aside>

            <div className="main-content">
                <header className="top-header">
                    <div className="header-left">
                        <h1>Content Management</h1>
                    </div>
                    <div className="header-right">
                        <span className="user-email">{userEmail}</span>
                        <button onClick={handleLogout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </header>

                <main className="content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
