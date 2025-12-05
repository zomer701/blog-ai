use anyhow::Result;
use tracing::{debug, info, warn};

use crate::models::{ScrapeResults, Site};
use crate::parsers::openai_product_releases::OpenAIProductReleasesParser;
use crate::parsers::openai_security::OpenAISecurityParser;
use crate::parsers::Parser;
use crate::storage::Storage;

pub struct ScraperService {
    storage: Storage,
}

impl ScraperService {
    pub async fn new() -> Result<Self> {
        let storage = Storage::from_env().await?;
        Ok(Self { storage })
    }

    /// Execute scraping for the provided sites. Currently stubbed; integrate
    /// real parsers/storage as they become available.
    pub async fn execute(&self, sites: &[Site]) -> Result<ScrapeResults> {
        let mut results = ScrapeResults::default();

        for site in sites {
            debug!(
                "Preparing scrape for {} (top_articles: {:?}, articles provided: {})",
                site.name,
                site.top_articles,
                site.articles.len(),
            );

            let parser = self.parser_for_site(&site.name);

            if let Some(limit) = site.top_articles {
                let added = self
                    .scrape_top_articles(site, limit, parser.as_deref())
                    .await?;
                results.new_articles += added;
            }

            if !site.articles.is_empty() {
                let added = self
                    .scrape_provided_articles(site, parser.as_deref())
                    .await?;
                results.new_articles += added;
            }

            if site.top_articles.is_none() && site.articles.is_empty() {
                warn!("No scrape instructions supplied for {}", site.name);
            }
        }

        Ok(results)
    }

    fn parser_for_site(&self, name: &str) -> Option<Box<dyn Parser>> {
        match name {
            "openai-product-releases" => Some(Box::new(OpenAIProductReleasesParser::new())),
            "openai-security" => Some(Box::new(OpenAISecurityParser::new())),
            _ => None,
        }
    }

    async fn scrape_top_articles(
        &self,
        site: &Site,
        limit: usize,
        parser: Option<&dyn Parser>,
    ) -> Result<usize> {
        let Some(parser) = parser else {
            warn!(
                "Top-article scraping not implemented for {} (requested {})",
                site.name, limit
            );
            return Ok(0);
        };

        let listing = parser.parse_listing().await?;
        let mut processed = 0;

        for item in listing.iter().take(limit) {
            info!(
                "TAG:LISTING NAME {}: listing -> {}",
                parser.name(),
                item.url
            );
            let article = parser.parse_article(&item.url).await?;
            let images = article.images.join(", ");
            self.storage
                .save_article_content(
                    parser.name(),
                    &item.title,
                    &item.category,
                    &item.date_text,
                    &item.url,
                    &article.content_html,
                    &article.content_text,
                    &article.images,
                )
                .await?;
            info!(
                "TAG:ARTICLE {}: parsed '{}' ({} chars) | content_html{} |, | images: {} |",
                parser.name(),
                article.title,
                article.content_text.len(),
                article.content_html,
                images
            );
            processed += 1;
        }

        Ok(processed)
    }

    async fn scrape_provided_articles(
        &self,
        site: &Site,
        parser: Option<&dyn Parser>,
    ) -> Result<usize> {
        let Some(parser) = parser else {
            warn!(
                "Article scraping not implemented for {}; skipping provided urls",
                site.name
            );
            return Ok(0);
        };

        let mut new_articles = 0;

        for url in &site.articles {
            info!("{}: scraping provided url {}", parser.name(), url);
            let article = parser.parse_article(url).await?;
            self.storage
                .save_article_content(
                    parser.name(),
                    &article.title,
                    "",
                    &article.published_date,
                    url,
                    &article.content_html,
                    &article.content_text,
                    &article.images,
                )
                .await?;
            info!(
                "{}: parsed '{}' ({} chars) | content_html{} |",
                parser.name(),
                article.title,
                article.content_text.len(),
                article.content_html
            );
            new_articles += 1;
        }

        Ok(new_articles)
    }
}
