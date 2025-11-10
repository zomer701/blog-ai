use anyhow::{Result, Context};
use async_trait::async_trait;
use scraper::{Html, Selector};
use reqwest::Client;

use crate::models::{ListingItem, ScrapedArticle};
use super::{Parser, extract_text, make_absolute_url};

pub struct TechCrunchParser {
    client: Client,
    base_url: String,
}

impl TechCrunchParser {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Mozilla/5.0 (compatible; BlogScraper/1.0)")
                .build()
                .unwrap(),
            base_url: "https://techcrunch.com".to_string(),
        }
    }
}

#[async_trait]
impl Parser for TechCrunchParser {
    fn name(&self) -> &str {
        "techcrunch"
    }
    
    async fn parse_listing(&self) -> Result<Vec<ListingItem>> {
        let url = format!("{}/category/artificial-intelligence/", self.base_url);
        let html = self.client.get(&url)
            .send()
            .await?
            .text()
            .await?;
        
        let document = Html::parse_document(&html);
        
        // TechCrunch selectors
        let item_selector = Selector::parse("article, .post-block").unwrap();
        let link_selector = Selector::parse("a.post-block__title__link, h2 a").unwrap();
        let title_selector = Selector::parse("h2, .post-block__title").unwrap();
        
        let mut items = Vec::new();
        
        for element in document.select(&item_selector) {
            if let Some(link) = element.select(&link_selector).next() {
                if let Some(href) = link.value().attr("href") {
                    let article_url = make_absolute_url(&self.base_url, href);
                    
                    let title = element.select(&title_selector)
                        .next()
                        .map(|t| t.text().collect::<String>())
                        .unwrap_or_else(|| "Untitled".to_string());
                    
                    items.push(ListingItem {
                        url: article_url,
                        title: title.trim().to_string(),
                    });
                }
            }
        }
        
        Ok(items)
    }
    
    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle> {
        let html = self.client.get(url)
            .send()
            .await?
            .text()
            .await?;
        
        let document = Html::parse_document(&html);
        
        // Extract title
        let title_selector = Selector::parse("h1.article__title, h1").unwrap();
        let title = document.select(&title_selector)
            .next()
            .map(|t| t.text().collect::<String>())
            .unwrap_or_else(|| "Untitled".to_string());
        
        // Extract author
        let author_selector = Selector::parse(".article__byline, .author").unwrap();
        let author = document.select(&author_selector)
            .next()
            .map(|a| a.text().collect::<String>())
            .unwrap_or_else(|| "TechCrunch".to_string());
        
        // Extract date
        let date_selector = Selector::parse(".article__date, time").unwrap();
        let published_date = document.select(&date_selector)
            .next()
            .and_then(|d| {
                d.value().attr("datetime")
                    .map(|s| s.to_string())
                    .or_else(|| Some(d.text().collect::<String>()))
            })
            .unwrap_or_else(|| "Unknown".to_string());
        
        // Extract content
        let content_selector = Selector::parse(".article-content, .entry-content").unwrap();
        let content_html = document.select(&content_selector)
            .next()
            .map(|c| c.html())
            .context("No content found")?;
        
        let content_text = extract_text(&content_html);
        
        // Extract images
        let img_selector = Selector::parse(".article-content img").unwrap();
        let images: Vec<String> = document.select(&img_selector)
            .filter_map(|img| img.value().attr("src"))
            .map(|src| make_absolute_url(&self.base_url, src))
            .collect();
        
        Ok(ScrapedArticle {
            title: title.trim().to_string(),
            author: author.trim().to_string(),
            published_date,
            content_html,
            content_text,
            images,
        })
    }
}
