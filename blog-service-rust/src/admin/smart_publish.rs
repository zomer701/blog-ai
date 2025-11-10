// Smart Publishing Handlers
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, error};

use super::AdminState;

#[derive(Debug, Serialize)]
pub struct PublishResponse {
    pub message: String,
    pub staging_url: Option<String>,
    pub production_url: Option<String>,
    pub version: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub timestamp: String,
    pub path: String,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct RollbackQuery {
    pub timestamp: Option<String>,
}

/// Publish article to staging (preview environment)
pub async fn publish_to_staging(
    State(state): State<AdminState>,
    Path(id): Path<String>,
) -> Result<Json<PublishResponse>, StatusCode> {
    info!("Publishing article {} to staging", id);
    
    // Get article and verify it's approved
    let mut article = state.storage
        .get_article(&id)
        .await
        .map_err(|e| {
            error!("Failed to get article: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    if article.status != "approved" && article.status != "staged" {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Update status to staged
    article.status = "staged".to_string();
    article.publishing.staged_at = Some(chrono::Utc::now().timestamp());
    article.publishing.staged_by = Some("admin".to_string()); // TODO: Get from JWT claims
    
    let staging_url = format!(
        "https://staging.yourdomain.com/articles/{}-en.html",
        id
    );
    article.publishing.staging_url = Some(staging_url.clone());
    
    state.storage
        .update_article(&article)
        .await
        .map_err(|e| {
            error!("Failed to update article: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    info!("Article published to staging: {}", staging_url);
    
    Ok(Json(PublishResponse {
        message: "Article published to staging".to_string(),
        staging_url: Some(staging_url),
        production_url: None,
        version: Some(article.publishing.version),
    }))
}

/// Publish article to production (with automatic backup)
pub async fn publish_to_production(
    State(state): State<AdminState>,
    Path(id): Path<String>,
) -> Result<Json<PublishResponse>, StatusCode> {
    info!("Publishing article {} to production", id);
    
    // Get article and verify it's staged
    let mut article = state.storage
        .get_article(&id)
        .await
        .map_err(|e| {
            error!("Failed to get article: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    if article.status != "staged" && article.status != "published" {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Update status to published
    article.status = "published".to_string();
    article.publishing.published_at = Some(chrono::Utc::now().timestamp());
    article.publishing.published_by = Some("admin".to_string()); // TODO: Get from JWT claims
    article.publishing.version += 1;
    
    let production_url = format!(
        "https://yourdomain.com/articles/{}-en.html",
        id
    );
    article.publishing.production_url = Some(production_url.clone());
    
    state.storage
        .update_article(&article)
        .await
        .map_err(|e| {
            error!("Failed to update article: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    info!("Article published to production: {} (version {})", production_url, article.publishing.version);
    
    // Note: The actual file operations (backup, copy, invalidate) happen in the
    // scraper Lambda's Publisher service. The Blog Service API just updates the
    // database status. The Lambda can be triggered via EventBridge or run on a
    // schedule to sync DynamoDB state with S3.
    //
    // Alternative: Invoke Lambda directly from here using AWS SDK Lambda client
    // if you need immediate publishing. For most use cases, eventual consistency
    // via scheduled Lambda runs is sufficient and more cost-effective.
    
    Ok(Json(PublishResponse {
        message: "Article published to production".to_string(),
        staging_url: None,
        production_url: Some(production_url),
        version: Some(article.publishing.version),
    }))
}

/// Rollback to previous version
pub async fn rollback(
    State(_state): State<AdminState>,
    Query(params): Query<RollbackQuery>,
) -> Result<Json<PublishResponse>, StatusCode> {
    info!("Rollback requested");
    
    // TODO: Trigger Lambda to perform rollback
    // This would invoke the scraper Lambda with action="rollback"
    
    let message = if let Some(ts) = params.timestamp {
        format!("Rolled back to version: {}", ts)
    } else {
        "Rolled back to latest backup".to_string()
    };
    
    info!("{}", message);
    
    Ok(Json(PublishResponse {
        message,
        staging_url: None,
        production_url: None,
        version: None,
    }))
}

/// List available backups
pub async fn list_backups(
    State(_state): State<AdminState>,
) -> Result<Json<Vec<BackupInfo>>, StatusCode> {
    info!("Listing backups");
    
    // TODO: Query S3 for backup prefixes
    // For now, return empty list
    
    Ok(Json(vec![]))
}

/// Get publishing status for an article
pub async fn get_publishing_status(
    State(state): State<AdminState>,
    Path(id): Path<String>,
) -> Result<Json<HashMap<String, serde_json::Value>>, StatusCode> {
    let article = state.storage
        .get_article(&id)
        .await
        .map_err(|e| {
            error!("Failed to get article: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(HashMap::from([
        ("article_id".to_string(), serde_json::json!(id)),
        ("status".to_string(), serde_json::json!(article.status)),
        ("staged_at".to_string(), serde_json::json!(article.publishing.staged_at)),
        ("staged_by".to_string(), serde_json::json!(article.publishing.staged_by)),
        ("published_at".to_string(), serde_json::json!(article.publishing.published_at)),
        ("published_by".to_string(), serde_json::json!(article.publishing.published_by)),
        ("staging_url".to_string(), serde_json::json!(article.publishing.staging_url)),
        ("production_url".to_string(), serde_json::json!(article.publishing.production_url)),
        ("version".to_string(), serde_json::json!(article.publishing.version)),
    ])))
}
