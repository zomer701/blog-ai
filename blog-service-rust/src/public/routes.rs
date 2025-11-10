// Public API routes configuration
use axum::Router;
use std::sync::Arc;
use super::handlers::{AppState, list_articles, get_article, search_articles, list_categories, track_view, health_check};
use axum::routing::{get, post};

pub fn create_public_routes(state: Arc<AppState>) -> Router {
    Router::new()
        // Article endpoints
        .route("/api/articles", get(list_articles))
        .route("/api/articles/:id", get(get_article))
        .route("/api/articles/search", get(search_articles))
        .route("/api/categories", get(list_categories))
        
        // Analytics
        .route("/api/articles/:id/view", post(track_view))
        
        // Health check
        .route("/health", get(health_check))
        
        .with_state(state)
}
