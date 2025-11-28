use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;
use tracing::{info, warn};

use crate::models::{ListingItem, ScrapedArticle};
use crate::parsers::{parse_openai_article, parse_openai_news_list, Parser, OPENAI_BASE};

const PRODUCT_RELEASES_URL: &str = "https://openai.com/news/product-releases/?display=list";

pub struct OpenAIProductReleasesParser {
    client: Client,
}

impl OpenAIProductReleasesParser {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Mozilla/5.0 (compatible; BlogScraper/1.0)")
                .build()
                .expect("failed to build reqwest client"),
        }
    }
}

#[async_trait]
impl Parser for OpenAIProductReleasesParser {
    fn name(&self) -> &str {
        "openai-product-releases"
    }

    async fn parse_listing(&self) -> Result<Vec<ListingItem>> {
        let html = self.client.get(PRODUCT_RELEASES_URL).send().await?.text().await?;
        let articles = parse_openai_news_list(&html, OPENAI_BASE);

        if articles.is_empty() {
            warn!(
                "TAG:OPENAI_PRODUCT_LISTING_EMPTY no listings parsed; url={}",
                PRODUCT_RELEASES_URL
            );
        }

        for article in &articles {
            info!(
                "TAG:OPENAI_PRODUCT_LISTING category=\"{}\" date=\"{}\" title=\"{}\" summary=\"{}\" url={}",
                article.category,
                article.date_text,
                article.title,
                article.summary,
                article.url,
            );
        }

        Ok(articles
            .into_iter()
            .map(|a| ListingItem {
                url: a.url,
                title: a.title,
                category: a.category,
                date_text: a.date_text,
            })
            .collect())
    }

    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle> {
        parse_openai_article(&self.client, url, self.name()).await
    }
}
