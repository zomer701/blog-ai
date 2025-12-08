use std::env;

use anyhow::Context;
use aws_sdk_s3::Client as S3Client;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use parser::utils::setup_tracing;
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum Action {
    RefreshIndex,
    PublishArticles,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct ArticleInput {
    id: String,
    title: Option<String>,
    body: Option<String>,
    media_urls: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct Request {
    action: Option<Action>,
    articles: Vec<ArticleInput>,
}

#[derive(Debug, Serialize)]
struct Response {
    message: String,
    processed: usize,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    setup_tracing();
    run(service_fn(function_handler)).await
}

async fn function_handler(event: LambdaEvent<Request>) -> Result<Response, Error> {
    let (request, _context) = event.into_parts();

    let bucket = env::var("PUBLIC_SITE_BUCKET")
        .context("PUBLIC_SITE_BUCKET env var is required")
        .map_err(lambda_runtime::Error::from)?;

    let config = aws_config::from_env().load().await;
    let s3 = S3Client::new(&config);

    // Placeholder: in the future, hydrate new article documents into S3 and rebuild
    // the static listing page. For now we just log intent to keep the interface stable.
    match request.action.unwrap_or(Action::RefreshIndex) {
        Action::RefreshIndex => {
            info!(
                "Refresh index requested. Bucket={}, articles_in_payload={}",
                bucket,
                request.articles.len()
            );
        }
        Action::PublishArticles => {
            info!(
                "Publish articles requested. Bucket={}, articles_in_payload={}",
                bucket,
                request.articles.len()
            );
        }
    }

    if request.articles.is_empty() {
        warn!("No articles provided; skipping publish.");
    } else {
        // Hook for future write operations, kept empty intentionally.
        let _client: &S3Client = &s3;
        let _bucket = bucket;
    }

    Ok(Response {
        message: "Publisher stub executed (no-op)".to_string(),
        processed: request.articles.len(),
    })
}
