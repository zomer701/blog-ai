use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use tracing::{debug, info, warn};

use crate::models::{ScrapeResults, Site};
use crate::parsers::parse_openai_article_html;
use crate::storage::Storage;

/// Fallback crawler: consumes provided_listing entries (e.g., S3-hosted HTML)
/// and parses articles without relying on a site-specific parser.
pub struct FallbackCrawlerService {
    storage: Storage,
    client: Client,
    s3: aws_sdk_s3::Client,
    snapshot_bucket: Option<String>,
}

impl FallbackCrawlerService {
    pub async fn new() -> Result<Self> {
        let storage = Storage::from_env().await?;
        let client = Client::builder()
            .build()
            .context("failed to build reqwest client for fallback crawler")?;
        let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
        let s3 = aws_sdk_s3::Client::new(&aws_config);
        let snapshot_bucket = std::env::var("SNAPSHOT_BUCKET").ok();

        Ok(Self {
            storage,
            client,
            s3,
            snapshot_bucket,
        })
    }

    pub async fn execute(&self, sites: &[Site]) -> Result<ScrapeResults> {
        let mut results = ScrapeResults::default();

        for site in sites {
            debug!(
                "Preparing fallback scrape for {} (provided listing: {}, force: {})",
                site.name,
                site.provided_listing.len(),
                site.force
            );

            if site.provided_listing.is_empty() {
                warn!(
                    "Fallback service requires provided_listing for {}; skipping",
                    site.name
                );
                continue;
            }

            let added = self.process_provided_listing(site).await?;
            results.new_articles += added;
        }

        Ok(results)
    }

    async fn process_provided_listing(&self, site: &Site) -> Result<usize> {
        let mut processed = 0;
        let items = if let Some(limit) = site.top_articles {
            site.provided_listing.iter().take(limit).collect::<Vec<_>>()
        } else {
            site.provided_listing.iter().collect::<Vec<_>>()
        };

        for item in items {
            if !site.force
                && self
                    .storage
                    .article_exists(&site.name, &item.title, &item.category, &item.date_text)
                    .await?
            {
                info!(
                    "{}: skipping existing provided article \"{}\" ({})",
                    site.name, item.title, item.url
                );
                continue;
            }

            info!(
                "TAG:FALLBACK_PROVIDED {}: {} -> {}",
                site.name, item.title, item.url
            );

            let html = self
                .fetch_body(&item.url)
                .await
                .with_context(|| format!("failed to fetch provided article: {}", item.url))?;

            let article = parse_openai_article_html(&html)?;

            self.storage
                .save_article_content(
                    &site.name,
                    if item.title.is_empty() {
                        &article.title
                    } else {
                        &item.title
                    },
                    &item.category,
                    &item.date_text,
                    &item.url,
                    &article.content_html,
                    &article.content_text,
                    &article.images,
                )
                .await?;

            processed += 1;
        }

        Ok(processed)
    }

    async fn fetch_body(&self, url: &str) -> Result<String> {
        if url.starts_with("s3://") {
            let path = url.trim_start_matches("s3://");
            let (bucket, key) = path
                .split_once('/')
                .ok_or_else(|| anyhow!("invalid s3 url, expected s3://bucket/key"))?;
            return self.fetch_s3(bucket, key).await;
        }

        if let Some(bucket) = &self.snapshot_bucket {
            if !url.contains("://") {
                // Treat as key in configured snapshot bucket.
                return self.fetch_s3(bucket, url.trim_start_matches('/')).await;
            }
        }

        let res = self
            .client
            .get(url)
            .send()
            .await
            .context("fallback fetch failed")?
            .error_for_status()
            .context("fallback returned error status")?;

        Ok(res.text().await.context("failed to read fallback body")?)
    }

    async fn fetch_s3(&self, bucket: &str, key: &str) -> Result<String> {
        let obj = self
            .s3
            .get_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .with_context(|| format!("failed to fetch s3://{}/{}", bucket, key))?;
        let data = obj
            .body
            .collect()
            .await
            .context("failed reading s3 object body")?;
        let bytes = data.into_bytes();
        String::from_utf8(bytes.to_vec()).context("s3 object was not valid UTF-8")
    }
}
