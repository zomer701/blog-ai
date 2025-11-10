// Public API handlers
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use aws_sdk_dynamodb::Client as DynamoClient;
use chrono::Utc;

// Shared state
#[derive(Clone)]
pub struct AppState {
    pub dynamo_client: DynamoClient,
    pub table_name: String,
    pub analytics_table: String,
}

// Request/Response models
#[derive(Debug, Deserialize)]
pub struct ListArticlesQuery {
    pub lang: Option<String>,        // en, es, uk
    pub category: Option<String>,    // testai, huggingface, techcrunch
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub lang: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ArticleResponse {
    pub id: String,
    pub title: String,
    pub content: String,
    pub excerpt: String,
    pub author: Option<String>,
    pub published_date: String,
    pub source: String,
    pub source_url: String,
    pub language: String,
    pub categories: Vec<String>,
    pub image_url: Option<String>,
    pub read_time_minutes: i32,
}

#[derive(Debug, Serialize)]
pub struct ArticleListResponse {
    pub articles: Vec<ArticleSummary>,
    pub total: i32,
    pub page: i32,
    pub total_pages: i32,
}

#[derive(Debug, Serialize)]
pub struct ArticleSummary {
    pub id: String,
    pub title: String,
    pub excerpt: String,
    pub published_date: String,
    pub source: String,
    pub language: String,
    pub categories: Vec<String>,
    pub image_url: Option<String>,
    pub read_time_minutes: i32,
}

#[derive(Debug, Serialize)]
pub struct CategoryResponse {
    pub categories: Vec<Category>,
}

#[derive(Debug, Serialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub count: i32,
}

// Handlers

/// List published articles with pagination and filtering
pub async fn list_articles(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListArticlesQuery>,
) -> Result<Json<ArticleListResponse>, StatusCode> {
    let lang = params.lang.unwrap_or_else(|| "en".to_string());
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(100);
    
    // Query DynamoDB for published articles
    let mut query = state.dynamo_client
        .query()
        .table_name(&state.table_name)
        .index_name("status-created_at-index")
        .key_condition_expression("status = :status")
        .expression_attribute_values(":status", aws_sdk_dynamodb::types::AttributeValue::S("published".to_string()));
    
    // Add category filter if provided
    if let Some(category) = params.category {
        query = query
            .filter_expression("source = :source")
            .expression_attribute_values(":source", aws_sdk_dynamodb::types::AttributeValue::S(category));
    }
    
    let result = query
        .scan_index_forward(false) // Most recent first
        .limit(limit)
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let items = result.items().unwrap_or_default();
    let total = result.count() as i32;
    let total_pages = (total as f32 / limit as f32).ceil() as i32;
    
    let articles: Vec<ArticleSummary> = items
        .iter()
        .filter_map(|item| parse_article_summary(item, &lang))
        .collect();
    
    Ok(Json(ArticleListResponse {
        articles,
        total,
        page,
        total_pages,
    }))
}

/// Get a single article by ID
pub async fn get_article(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(params): Query<ListArticlesQuery>,
) -> Result<Json<ArticleResponse>, StatusCode> {
    let lang = params.lang.unwrap_or_else(|| "en".to_string());
    
    let result = state.dynamo_client
        .get_item()
        .table_name(&state.table_name)
        .key("id", aws_sdk_dynamodb::types::AttributeValue::S(id.clone()))
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let item = result.item().ok_or(StatusCode::NOT_FOUND)?;
    
    // Check if article is published
    let status = item.get("status")
        .and_then(|v| v.as_s().ok())
        .ok_or(StatusCode::NOT_FOUND)?;
    
    if status != "published" {
        return Err(StatusCode::NOT_FOUND);
    }
    
    let article = parse_article(item, &lang)?;
    
    Ok(Json(article))
}

/// Search articles by query
pub async fn search_articles(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<ArticleListResponse>, StatusCode> {
    let lang = params.lang.unwrap_or_else(|| "en".to_string());
    let query = params.q.to_lowercase();
    
    // Scan published articles (in production, use OpenSearch/Elasticsearch)
    let mut scan = state.dynamo_client
        .scan()
        .table_name(&state.table_name)
        .filter_expression("status = :status")
        .expression_attribute_values(":status", aws_sdk_dynamodb::types::AttributeValue::S("published".to_string()));
    
    if let Some(category) = params.category {
        scan = scan
            .filter_expression("status = :status AND source = :source")
            .expression_attribute_values(":source", aws_sdk_dynamodb::types::AttributeValue::S(category));
    }
    
    let result = scan
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let items = result.items().unwrap_or_default();
    
    // Filter by search query
    let articles: Vec<ArticleSummary> = items
        .iter()
        .filter_map(|item| {
            let summary = parse_article_summary(item, &lang)?;
            
            // Search in title and excerpt
            if summary.title.to_lowercase().contains(&query) ||
               summary.excerpt.to_lowercase().contains(&query) {
                Some(summary)
            } else {
                None
            }
        })
        .collect();
    
    let total = articles.len() as i32;
    
    Ok(Json(ArticleListResponse {
        articles,
        total,
        page: 1,
        total_pages: 1,
    }))
}

/// List available categories with article counts
pub async fn list_categories(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CategoryResponse>, StatusCode> {
    // Query all published articles and count by source
    let result = state.dynamo_client
        .query()
        .table_name(&state.table_name)
        .index_name("status-created_at-index")
        .key_condition_expression("status = :status")
        .expression_attribute_values(":status", aws_sdk_dynamodb::types::AttributeValue::S("published".to_string()))
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let items = result.items().unwrap_or_default();
    
    // Count by source
    let mut counts = std::collections::HashMap::new();
    for item in items {
        if let Some(source) = item.get("source").and_then(|v| v.as_s().ok()) {
            *counts.entry(source.to_string()).or_insert(0) += 1;
        }
    }
    
    let categories: Vec<Category> = counts
        .into_iter()
        .map(|(id, count)| Category {
            name: format_category_name(&id),
            id,
            count,
        })
        .collect();
    
    Ok(Json(CategoryResponse { categories }))
}

/// Track article view for analytics
pub async fn track_view(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let timestamp = Utc::now().to_rfc3339();
    
    state.dynamo_client
        .put_item()
        .table_name(&state.analytics_table)
        .item("article_id", aws_sdk_dynamodb::types::AttributeValue::S(id))
        .item("timestamp", aws_sdk_dynamodb::types::AttributeValue::S(timestamp.clone()))
        .item("event_type", aws_sdk_dynamodb::types::AttributeValue::S("view".to_string()))
        .item("ttl", aws_sdk_dynamodb::types::AttributeValue::N((Utc::now().timestamp() + 7776000).to_string())) // 90 days
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(StatusCode::NO_CONTENT)
}

/// Health check endpoint
pub async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "timestamp": Utc::now().to_rfc3339()
    })))
}

// Helper functions

fn parse_article(item: &std::collections::HashMap<String, aws_sdk_dynamodb::types::AttributeValue>, lang: &str) -> Result<ArticleResponse, StatusCode> {
    let id = item.get("id").and_then(|v| v.as_s().ok()).ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let source = item.get("source").and_then(|v| v.as_s().ok()).unwrap_or("unknown");
    let source_url = item.get("source_url").and_then(|v| v.as_s().ok()).unwrap_or("");
    let published_date = item.get("published_date").and_then(|v| v.as_s().ok()).unwrap_or("");
    let author = item.get("author").and_then(|v| v.as_s().ok()).map(|s| s.to_string());
    
    // Get content based on language
    let (title, content) = match lang {
        "es" => (
            item.get("title_es").and_then(|v| v.as_s().ok()),
            item.get("content_es").and_then(|v| v.as_s().ok()),
        ),
        "uk" => (
            item.get("title_uk").and_then(|v| v.as_s().ok()),
            item.get("content_uk").and_then(|v| v.as_s().ok()),
        ),
        _ => (
            item.get("title").and_then(|v| v.as_s().ok()),
            item.get("content").and_then(|v| v.as_s().ok()),
        ),
    };
    
    let title = title.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let content = content.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let excerpt = generate_excerpt(content, 200);
    let read_time = calculate_read_time(content);
    
    Ok(ArticleResponse {
        id: id.to_string(),
        title: title.to_string(),
        content: content.to_string(),
        excerpt,
        author,
        published_date: published_date.to_string(),
        source: source.to_string(),
        source_url: source_url.to_string(),
        language: lang.to_string(),
        categories: vec![source.to_string()],
        image_url: None, // TODO: Extract from content or metadata
        read_time_minutes: read_time,
    })
}

fn parse_article_summary(item: &std::collections::HashMap<String, aws_sdk_dynamodb::types::AttributeValue>, lang: &str) -> Option<ArticleSummary> {
    let id = item.get("id")?.as_s().ok()?;
    let source = item.get("source")?.as_s().ok()?;
    let published_date = item.get("published_date")?.as_s().ok()?;
    
    let (title, content) = match lang {
        "es" => (
            item.get("title_es")?.as_s().ok()?,
            item.get("content_es")?.as_s().ok()?,
        ),
        "uk" => (
            item.get("title_uk")?.as_s().ok()?,
            item.get("content_uk")?.as_s().ok()?,
        ),
        _ => (
            item.get("title")?.as_s().ok()?,
            item.get("content")?.as_s().ok()?,
        ),
    };
    
    let excerpt = generate_excerpt(content, 200);
    let read_time = calculate_read_time(content);
    
    Some(ArticleSummary {
        id: id.to_string(),
        title: title.to_string(),
        excerpt,
        published_date: published_date.to_string(),
        source: source.to_string(),
        language: lang.to_string(),
        categories: vec![source.to_string()],
        image_url: None,
        read_time_minutes: read_time,
    })
}

fn generate_excerpt(content: &str, max_length: usize) -> String {
    let text: String = content.chars().take(max_length).collect();
    if content.len() > max_length {
        format!("{}...", text)
    } else {
        text
    }
}

fn calculate_read_time(content: &str) -> i32 {
    let word_count = content.split_whitespace().count();
    ((word_count as f32 / 200.0).ceil() as i32).max(1) // 200 words per minute
}

fn format_category_name(id: &str) -> String {
    match id {
        "testai" => "testai".to_string(),
        "huggingface" => "Hugging Face".to_string(),
        "techcrunch" => "TechCrunch".to_string(),
        _ => id.to_string(),
    }
}
