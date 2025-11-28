use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;

use crate::parsers::{parse_openai_article, parse_openai_listing, Parser};

const SECURITY_URL: &str = "https://openai.com/news/security/";

pub struct OpenAISecurityParser {
    client: Client,
}

impl OpenAISecurityParser {
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
impl Parser for OpenAISecurityParser {
    fn name(&self) -> &str {
        "openai-security"
    }

    async fn parse_listing(&self) -> Result<Vec<crate::models::ListingItem>> {
        parse_openai_listing(&self.client, SECURITY_URL, self.name()).await
    }

    async fn parse_article(&self, url: &str) -> Result<crate::models::ScrapedArticle> {
        parse_openai_article(&self.client, url, self.name()).await
    }
}
