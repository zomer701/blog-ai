use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;

use crate::models::{ListingItem, ScrapedArticle};
use crate::parsers::{
    fetch_openai_news_listing, parse_openai_article, Parser, OPENAI_SAFETY_ALIGNMENT_LISTING,
};

pub struct OpenAISafetyAlignmentParser {
    client: Client,
}

impl OpenAISafetyAlignmentParser {
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
impl Parser for OpenAISafetyAlignmentParser {
    fn name(&self) -> &str {
        "openai-safety-alignment"
    }

    async fn parse_listing(&self) -> Result<Vec<ListingItem>> {
        fetch_openai_news_listing(&self.client, OPENAI_SAFETY_ALIGNMENT_LISTING, self.name()).await
    }

    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle> {
        parse_openai_article(&self.client, url, self.name()).await
    }
}
