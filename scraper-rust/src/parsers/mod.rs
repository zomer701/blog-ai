use anyhow::Result;
use async_trait::async_trait;

use crate::models::{ListingItem, ScrapedArticle};

pub mod testai;
pub mod huggingface;
pub mod techcrunch;

/// Parser trait that each site-specific parser must implement
#[async_trait]
pub trait Parser: Send + Sync {
    /// Name of the site (e.g., "testai", "huggingface")
    fn name(&self) -> &str;
    
    /// Parse the listing page and return article URLs
    async fn parse_listing(&self) -> Result<Vec<ListingItem>>;
    
    /// Parse a single article page and extract content
    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle>;
}

/// Helper function to extract text from HTML
pub fn extract_text(html: &str) -> String {
    use scraper::{Html, Selector};
    
    let document = Html::parse_document(html);
    let body_selector = Selector::parse("body").unwrap();
    
    if let Some(body) = document.select(&body_selector).next() {
        body.text().collect::<Vec<_>>().join(" ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        String::new()
    }
}

/// Helper function to make absolute URLs
pub fn make_absolute_url(base: &str, url: &str) -> String {
    if url.starts_with("http") {
        url.to_string()
    } else if url.starts_with("//") {
        format!("https:{}", url)
    } else if url.starts_with('/') {
        let base_url = url::Url::parse(base).unwrap();
        format!("{}://{}{}", base_url.scheme(), base_url.host_str().unwrap(), url)
    } else {
        format!("{}/{}", base.trim_end_matches('/'), url)
    }
}
