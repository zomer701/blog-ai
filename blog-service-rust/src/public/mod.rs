// Public API module for serving articles to end users
pub mod handlers;
pub mod routes;

use axum::{
    Router,
    routing::{get, post},
};

pub fn create_router() -> Router {
    Router::new()
        // Article endpoints
        .route("/api/articles", get(handlers::list_articles))
        .route("/api/articles/:id", get(handlers::get_article))
        .route("/api/articles/search", get(handlers::search_articles))
        .route("/api/articles/categories", get(handlers::list_categories))
        
        // Analytics endpoint
        .route("/api/articles/:id/view", post(handlers::track_view))
        
        // Health check
        .route("/health", get(handlers::health_check))
}
