// Blog Admin Service - Axum REST API
use axum::{
    routing::{get, post, put, delete},
    Router,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};
use std::sync::Arc;

mod admin;
mod storage;

use storage::Storage;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Initialize AWS clients
    let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let dynamo_client = aws_sdk_dynamodb::Client::new(&aws_config);
    let s3_client = aws_sdk_s3::Client::new(&aws_config);
    
    let table_name = std::env::var("DYNAMODB_TABLE_NAME")
        .unwrap_or_else(|_| "blog-articles".to_string());
    let bucket_name = std::env::var("S3_BUCKET_NAME")
        .unwrap_or_else(|_| "blog-content-bucket".to_string());
    
    let storage = Arc::new(Storage::new(
        dynamo_client,
        s3_client,
        table_name,
        bucket_name,
    ));

    // Initialize Cognito auth (stub for now)
    let cognito = Arc::new(
        admin::auth::CognitoAuth::new(
            std::env::var("COGNITO_USER_POOL_ID").unwrap_or_default(),
            std::env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
        )
        .await
        .expect("Failed to initialize Cognito auth")
    );

    let state = admin::AdminState {
        cognito,
        storage,
    };

    // Build the application router
    let app = Router::new()
        // Health check
        .route("/health", get(health_check))
        
        // Admin API routes (protected by Cognito JWT)
        .route("/admin/articles", get(admin::handlers::list_articles))
        .route("/admin/articles/:id", get(admin::handlers::get_article))
        .route("/admin/articles/:id", put(admin::handlers::update_article))
        .route("/admin/articles/:id/publish", post(admin::handlers::publish_article))
        .route("/admin/articles/:id/unpublish", post(admin::handlers::unpublish_article))
        .route("/admin/articles/:id", delete(admin::handlers::delete_article))
        
        // Smart Publishing routes
        .route("/admin/articles/:id/publish-staging", post(admin::smart_publish::publish_to_staging))
        .route("/admin/articles/:id/publish-production", post(admin::smart_publish::publish_to_production))
        .route("/admin/articles/:id/publishing-status", get(admin::smart_publish::get_publishing_status))
        .route("/admin/rollback", post(admin::smart_publish::rollback))
        .route("/admin/backups", get(admin::smart_publish::list_backups))
        
        // Search API
        .route("/api/search", get(admin::handlers::search_articles))
        
        // Analytics API
        .route("/api/analytics/track", post(admin::handlers::track_analytics))
        .route("/api/analytics/articles/:id", get(admin::handlers::get_article_analytics))
        .route("/api/analytics/popular", get(admin::handlers::get_popular_articles))
        .route("/api/analytics/dashboard", get(admin::handlers::get_dashboard_stats))
        
        .with_state(state)
        
        // CORS configuration
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        );

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Admin API listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app)
        .await
        .unwrap();
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({
        "status": "healthy",
        "service": "blog-admin-api",
        "version": env!("CARGO_PKG_VERSION")
    })))
}
