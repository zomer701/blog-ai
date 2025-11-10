use axum::{
    routing::{get, post, put},
    Router,
    middleware,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

pub mod auth;
pub mod handlers;
pub mod smart_publish;

use auth::CognitoAuth;

#[derive(Clone)]
pub struct AdminState {
    pub cognito: Arc<CognitoAuth>,
    pub storage: Arc<crate::storage::Storage>,
}

pub fn admin_routes(state: AdminState) -> Router {
    Router::new()
        // Public routes (require authentication)
        .route("/articles/pending", get(handlers::list_pending))
        .route("/articles/:id", get(handlers::get_article))
        .route("/articles/:id", put(handlers::update_article))
        .route("/articles/:id/publish", post(handlers::publish_article))
        .route("/articles/:id/reject", post(handlers::reject_article))
        .route("/articles/:id/translations", put(handlers::update_translations))
        .route("/stats", get(handlers::get_stats))
        .route("/regenerate-listing", post(handlers::regenerate_listing))
        // Apply Cognito authentication middleware
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::cognito_auth_middleware
        ))
        .with_state(state)
}

#[derive(Debug, Deserialize)]
pub struct ArticleUpdate {
    pub title: Option<String>,
    pub content: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TranslationUpdate {
    pub es: Option<TranslationData>,
    pub uk: Option<TranslationData>,
}

#[derive(Debug, Deserialize)]
pub struct TranslationData {
    pub title: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct Stats {
    pub total: usize,
    pub pending: usize,
    pub published: usize,
    pub rejected: usize,
}
