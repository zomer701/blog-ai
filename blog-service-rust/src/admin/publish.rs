// Admin publish handlers
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use aws_sdk_dynamodb::Client as DynamoClient;
use aws_sdk_s3::Client as S3Client;

#[derive(Clone)]
pub struct PublishState {
    pub dynamo_client: DynamoClient,
    pub s3_client: S3Client,
    pub table_name: String,
    pub public_bucket: String,
}

#[derive(Debug, Serialize)]
pub struct PublishResponse {
    pub success: bool,
    pub article_id: String,
    pub published_urls: std::collections::HashMap<String, String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct PublishRequest {
    pub regenerate_listing: Option<bool>,
}

/// Publish an approved article to the public website
pub async fn publish_article(
    State(state): State<Arc<PublishState>>,
    Path(id): Path<String>,
    Json(req): Json<PublishRequest>,
) -> Result<Json<PublishResponse>, StatusCode> {
    // Get article from DynamoDB
    let result = state.dynamo_client
        .get_item()
        .table_name(&state.table_name)
        .key("id", aws_sdk_dynamodb::types::AttributeValue::S(id.clone()))
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let item = result.item().ok_or(StatusCode::NOT_FOUND)?;
    
    // Check if article is approved
    let status = item.get("status")
        .and_then(|v| v.as_s().ok())
        .ok_or(StatusCode::BAD_REQUEST)?;
    
    if status != "approved" && status != "published" {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    // Generate HTML for all languages
    let mut published_urls = std::collections::HashMap::new();
    
    for lang in &["en", "es", "uk"] {
        let html = generate_article_html(&item, lang)?;
        let key = format!("articles/{}-{}.html", id, lang);
        
        // Upload to S3
        state.s3_client
            .put_object()
            .bucket(&state.public_bucket)
            .key(&key)
            .body(html.as_bytes().to_vec().into())
            .content_type("text/html; charset=utf-8")
            .cache_control("public, max-age=3600")
            .send()
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        published_urls.insert(lang.to_string(), format!("/{}", key));
    }
    
    // Update article status to published
    state.dynamo_client
        .update_item()
        .table_name(&state.table_name)
        .key("id", aws_sdk_dynamodb::types::AttributeValue::S(id.clone()))
        .update_expression("SET #status = :status, published_at = :published_at")
        .expression_attribute_names("#status", "status")
        .expression_attribute_values(":status", aws_sdk_dynamodb::types::AttributeValue::S("published".to_string()))
        .expression_attribute_values(":published_at", aws_sdk_dynamodb::types::AttributeValue::S(chrono::Utc::now().to_rfc3339()))
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Regenerate listing page if requested
    if req.regenerate_listing.unwrap_or(true) {
        regenerate_listing_page(&state).await?;
    }
    
    Ok(Json(PublishResponse {
        success: true,
        article_id: id,
        published_urls,
        message: "Article published successfully".to_string(),
    }))
}

/// Unpublish an article (remove from public site)
pub async fn unpublish_article(
    State(state): State<Arc<PublishState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    // Delete all language versions from S3
    for lang in &["en", "es", "uk"] {
        let key = format!("articles/{}-{}.html", id, lang);
        state.s3_client
            .delete_object()
            .bucket(&state.public_bucket)
            .key(&key)
            .send()
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    
    // Update article status
    state.dynamo_client
        .update_item()
        .table_name(&state.table_name)
        .key("id", aws_sdk_dynamodb::types::AttributeValue::S(id))
        .update_expression("SET #status = :status")
        .expression_attribute_names("#status", "status")
        .expression_attribute_values(":status", aws_sdk_dynamodb::types::AttributeValue::S("approved".to_string()))
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Regenerate listing page
    regenerate_listing_page(&state).await?;
    
    Ok(StatusCode::NO_CONTENT)
}

/// Regenerate the listing page with all published articles
async fn regenerate_listing_page(state: &PublishState) -> Result<(), StatusCode> {
    // Query all published articles
    let result = state.dynamo_client
        .query()
        .table_name(&state.table_name)
        .index_name("status-created_at-index")
        .key_condition_expression("status = :status")
        .expression_attribute_values(":status", aws_sdk_dynamodb::types::AttributeValue::S("published".to_string()))
        .scan_index_forward(false) // Most recent first
        .limit(50) // Show latest 50 articles
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let items = result.items().unwrap_or_default();
    
    // Generate listing HTML
    let listing_html = generate_listing_html(&items)?;
    
    // Upload to S3
    state.s3_client
        .put_object()
        .bucket(&state.public_bucket)
        .key("index.html")
        .body(listing_html.as_bytes().to_vec().into())
        .content_type("text/html; charset=utf-8")
        .cache_control("public, max-age=3600")
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Upload CSS
    let css = generate_stylesheet();
    state.s3_client
        .put_object()
        .bucket(&state.public_bucket)
        .key("static/styles.css")
        .body(css.as_bytes().to_vec().into())
        .content_type("text/css; charset=utf-8")
        .cache_control("public, max-age=86400")
        .send()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(())
}

// HTML generation helpers (simplified versions)

fn generate_article_html(item: &std::collections::HashMap<String, aws_sdk_dynamodb::types::AttributeValue>, lang: &str) -> Result<String, StatusCode> {
    let title = match lang {
        "es" => item.get("title_es"),
        "uk" => item.get("title_uk"),
        _ => item.get("title"),
    }.and_then(|v| v.as_s().ok()).ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let content = match lang {
        "es" => item.get("content_es"),
        "uk" => item.get("content_uk"),
        _ => item.get("content"),
    }.and_then(|v| v.as_s().ok()).ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let source = item.get("source").and_then(|v| v.as_s().ok()).unwrap_or("unknown");
    let source_url = item.get("source_url").and_then(|v| v.as_s().ok()).unwrap_or("");
    let published_date = item.get("published_date").and_then(|v| v.as_s().ok()).unwrap_or("");
    
    Ok(format!(r#"<!DOCTYPE html>
<html lang="{}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <header>
        <nav class="container">
            <h1><a href="/">AI & Tech Blog</a></h1>
        </nav>
    </header>
    <main class="container">
        <article>
            <h1>{}</h1>
            <div class="meta">
                <time>{}</time>
                <span>Source: {}</span>
            </div>
            <div class="content">{}</div>
            <footer>
                <a href="{}">Read original article</a>
            </footer>
        </article>
    </main>
</body>
</html>"#, lang, title, title, published_date, source, content, source_url))
}

fn generate_listing_html(items: &[std::collections::HashMap<String, aws_sdk_dynamodb::types::AttributeValue>]) -> Result<String, StatusCode> {
    let articles_html: String = items.iter()
        .filter_map(|item| {
            let id = item.get("id")?.as_s().ok()?;
            let title = item.get("title")?.as_s().ok()?;
            let published_date = item.get("published_date")?.as_s().ok()?;
            let source = item.get("source")?.as_s().ok()?;
            
            Some(format!(r#"<article class="card">
                <h2><a href="/articles/{}-en.html">{}</a></h2>
                <div class="meta">
                    <time>{}</time>
                    <span>{}</span>
                </div>
                <div class="languages">
                    <a href="/articles/{}-en.html">EN</a>
                    <a href="/articles/{}-es.html">ES</a>
                    <a href="/articles/{}-uk.html">UK</a>
                </div>
            </article>"#, id, title, published_date, source, id, id, id))
        })
        .collect();
    
    Ok(format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI & Tech Blog</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <header>
        <nav class="container">
            <h1>AI & Tech Blog</h1>
            <p>Latest news from testai, Hugging Face, and TechCrunch</p>
        </nav>
    </header>
    <main class="container">
        <div class="grid">
            {}
        </div>
    </main>
</body>
</html>"#, articles_html))
}

fn generate_stylesheet() -> String {
    r#"* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
header { background: #fff; padding: 2rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
header h1 { font-size: 2rem; color: #2563eb; }
header h1 a { color: inherit; text-decoration: none; }
main { padding: 2rem 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 2rem; }
.card { background: #fff; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.card h2 { margin-bottom: 0.5rem; }
.card h2 a { color: #1a1a1a; text-decoration: none; }
.card h2 a:hover { color: #2563eb; }
.meta { color: #666; font-size: 0.9rem; margin: 0.5rem 0; }
.languages { margin-top: 1rem; }
.languages a { margin-right: 1rem; color: #2563eb; text-decoration: none; }
article .content { margin: 2rem 0; }
article footer { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e5e5; }"#.to_string()
}
