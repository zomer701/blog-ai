use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use tracing::{info, error};
use std::sync::Arc;
use aws_sdk_cloudfront::Client as CloudFrontClient;

mod config;
mod models;
mod scraper;
mod storage;
mod translator;
mod html_generator;
mod parsers;
mod publisher;

use config::Config;
use scraper::ScraperService;
use storage::Storage;
use publisher::Publisher;

/// Lambda event input (can be empty for scheduled events)
#[derive(Deserialize)]
struct Request {
    /// Optional: specific sites to scrape (defaults to all)
    #[serde(default)]
    sites: Vec<String>,
    /// Optional: max articles per site (overrides env var)
    max_articles: Option<usize>,
    /// Optional: action to perform (scrape, publish, rollback)
    action: Option<String>,
    /// Optional: article ID for publish action
    article_id: Option<String>,
    /// Optional: backup timestamp for rollback
    backup_timestamp: Option<String>,
}

/// Lambda response
#[derive(Serialize)]
struct Response {
    message: String,
    new_articles: usize,
    errors: Vec<String>,
    success: bool,
}

/// Main Lambda handler
async fn function_handler(event: LambdaEvent<Request>) -> Result<Response, Error> {
    let (request, _context) = event.into_parts();
    
    // Load configuration
    let config = Config::from_env()?;
    
    // Initialize AWS clients
    let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let storage = Arc::new(Storage::new(&aws_config, &config));
    
    // Handle different actions
    match request.action.as_deref() {
        Some("publish") => {
            info!("Publishing action requested");
            handle_publish(storage, &aws_config, request.article_id).await
        }
        Some("rollback") => {
            info!("Rollback action requested");
            handle_rollback(storage, &aws_config, request.backup_timestamp).await
        }
        _ => {
            info!("Starting blog scraper...");
            info!("Sites filter: {:?}", request.sites);
            info!("Max articles: {:?}", request.max_articles);
            
            // Initialize scraper service
            let scraper = ScraperService::new(storage.clone());
            
            // Run scraping for all sites
            match scraper.run_all().await {
                Ok(results) => {
                    info!("Scraping completed successfully");
                    info!("New articles found: {}", results.new_articles);
                    info!("Errors: {}", results.errors.len());
                    
                    for error in &results.errors {
                        error!("Error: {}", error);
                    }
                    
                    Ok(Response {
                        message: "Scraping completed successfully".to_string(),
                        new_articles: results.new_articles,
                        errors: results.errors,
                        success: true,
                    })
                }
                Err(e) => {
                    error!("Scraping failed: {}", e);
                    
                    Ok(Response {
                        message: format!("Scraping failed: {}", e),
                        new_articles: 0,
                        errors: vec![e.to_string()],
                        success: false,
                    })
                }
            }
        }
    }
}

async fn handle_publish(
    storage: Arc<Storage>,
    aws_config: &aws_config::SdkConfig,
    article_id: Option<String>,
) -> Result<Response, Error> {
    let article_id = article_id.ok_or("article_id required for publish action")?;
    
    // Initialize publisher with CloudFront if enabled
    let mut publisher = Publisher::new(storage);
    
    if let (Ok(staging_dist), Ok(prod_dist)) = (
        std::env::var("STAGING_DISTRIBUTION_ID"),
        std::env::var("PRODUCTION_DISTRIBUTION_ID"),
    ) {
        let cloudfront = CloudFrontClient::new(aws_config);
        publisher = publisher.with_cloudfront(cloudfront, staging_dist, prod_dist);
    }
    
    match publisher.publish_article_to_production(&article_id, "lambda").await {
        Ok(_) => {
            info!("Article published successfully");
            Ok(Response {
                message: format!("Article {} published to production", article_id),
                new_articles: 1,
                errors: vec![],
                success: true,
            })
        }
        Err(e) => {
            error!("Publish failed: {}", e);
            Ok(Response {
                message: format!("Publish failed: {}", e),
                new_articles: 0,
                errors: vec![e.to_string()],
                success: false,
            })
        }
    }
}

async fn handle_rollback(
    storage: Arc<Storage>,
    aws_config: &aws_config::SdkConfig,
    backup_timestamp: Option<String>,
) -> Result<Response, Error> {
    // Initialize publisher with CloudFront if enabled
    let mut publisher = Publisher::new(storage);
    
    if let (Ok(staging_dist), Ok(prod_dist)) = (
        std::env::var("STAGING_DISTRIBUTION_ID"),
        std::env::var("PRODUCTION_DISTRIBUTION_ID"),
    ) {
        let cloudfront = CloudFrontClient::new(aws_config);
        publisher = publisher.with_cloudfront(cloudfront, staging_dist, prod_dist);
    }
    
    match publisher.rollback(backup_timestamp.clone()).await {
        Ok(_) => {
            let message = if let Some(ts) = backup_timestamp {
                format!("Rolled back to version: {}", ts)
            } else {
                "Rolled back to latest backup".to_string()
            };
            
            info!("{}", message);
            Ok(Response {
                message,
                new_articles: 0,
                errors: vec![],
                success: true,
            })
        }
        Err(e) => {
            error!("Rollback failed: {}", e);
            Ok(Response {
                message: format!("Rollback failed: {}", e),
                new_articles: 0,
                errors: vec![e.to_string()],
                success: false,
            })
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing for Lambda
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();
    
    // Run the Lambda runtime
    run(service_fn(function_handler)).await
}
