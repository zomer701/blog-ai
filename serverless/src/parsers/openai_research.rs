use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;

use crate::models::{ListingItem, ScrapedArticle};
use crate::parsers::{
    fetch_openai_news_listing, parse_openai_article, Parser, OPENAI_RESEARCH_LISTING,
};

pub struct OpenAIResearchParser {
    client: Client,
}

impl OpenAIResearchParser {
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
impl Parser for OpenAIResearchParser {
    fn name(&self) -> &str {
        "openai-research"
    }

    async fn parse_listing(&self) -> Result<Vec<ListingItem>> {
        fetch_openai_news_listing(&self.client, OPENAI_RESEARCH_LISTING, self.name()).await
    }

    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle> {
        parse_openai_article(&self.client, url, self.name()).await
    }
}
