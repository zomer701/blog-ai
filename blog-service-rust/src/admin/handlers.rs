use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;

use super::{AdminState, ArticleUpdate, TranslationUpdate, Stats};

#[allow(dead_code)]
pub async fn list_pending(
    State(_state): State<AdminState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    // TODO: Implement with storage
    Ok(Json(vec![]))
}

pub async fn get_article(
    State(state): State<AdminState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let article = state.storage
        .get_article(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(serde_json::to_value(article).unwrap_or(serde_json::json!({}))))
}

pub async fn update_article(
    State(state): State<AdminState>,
    Path(id): Path<String>,
    Json(update): Json<ArticleUpdate>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut article = state.storage
        .get_article(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    if let Some(title) = update.title {
        article.title = title;
    }
    if let Some(content) = update.content {
        article.content.text = content;
    }
    if let Some(status) = update.status {
        article.status = status;
    }
    
    state.storage
        .update_article(&article)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({
        "message": "Article updated successfully"
    })))
}

#[allow(dead_code)]
pub async fn update_translations(
    State(_state): State<AdminState>,
    Path(_id): Path<String>,
    Json(_update): Json<TranslationUpdate>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: Implement with storage
    Ok(Json(serde_json::json!({
        "message": "Translations updated successfully"
    })))
}

pub async fn publish_article(
    State(_state): State<AdminState>,
    Path(_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: Implement with storage
    Ok(Json(serde_json::json!({
        "message": "Article published successfully"
    })))
}

#[allow(dead_code)]
pub async fn reject_article(
    State(_state): State<AdminState>,
    Path(_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: Implement with storage
    Ok(Json(serde_json::json!({
        "message": "Article rejected"
    })))
}

#[allow(dead_code)]
pub async fn get_stats(
    State(_state): State<AdminState>,
) -> Result<Json<Stats>, StatusCode> {
    // TODO: Implement proper stats query
    Ok(Json(Stats {
        total: 0,
        pending: 0,
        published: 0,
        rejected: 0,
    }))
}

#[allow(dead_code)]
pub async fn regenerate_listing(
    State(_state): State<AdminState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: Regenerate listing page HTML
    Ok(Json(serde_json::json!({
        "message": "Listing page regenerated"
    })))
}

// Stub handlers for routes in main.rs
pub async fn list_articles(
    State(state): State<AdminState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    let articles = state.storage
        .list_articles(None)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let json_articles: Vec<serde_json::Value> = articles
        .into_iter()
        .map(|a| serde_json::to_value(a).unwrap_or(serde_json::json!({})))
        .collect();
    
    Ok(Json(json_articles))
}

pub async fn unpublish_article(
    State(state): State<AdminState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut article = state.storage
        .get_article(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    article.status = "approved".to_string();
    
    state.storage
        .update_article(&article)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({"message": "Article unpublished"})))
}

pub async fn delete_article(
    State(state): State<AdminState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state.storage
        .delete_article(&id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({"message": "Article deleted"})))
}

pub async fn search_articles(
    State(_state): State<AdminState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    Ok(Json(vec![]))
}

pub async fn track_analytics(
    State(_state): State<AdminState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({"message": "Analytics tracked"})))
}

pub async fn get_article_analytics(
    State(_state): State<AdminState>,
    Path(_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({"views": 0})))
}

pub async fn get_popular_articles(
    State(_state): State<AdminState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    Ok(Json(vec![]))
}

pub async fn get_dashboard_stats(
    State(_state): State<AdminState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({"total": 0})))
}
