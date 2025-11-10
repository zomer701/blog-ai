use anyhow::Result;
use std::sync::Arc;
use tracing::{info, warn};

use crate::models::{Article, ScrapeResults};
use crate::storage::Storage;
use crate::parsers::{Parser, testai, huggingface, techcrunch};

pub struct ScraperService {
    storage: Arc<Storage>,
}

impl ScraperService {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self { storage }
    }
    
    pub async fn run_all(&self) -> Result<ScrapeResults> {
        let mut results = ScrapeResults::default();
        
        // Initialize parsers
        let parsers: Vec<Box<dyn Parser>> = vec![
            Box::new(testai::testaiParser::new()),
            Box::new(huggingface::HuggingFaceParser::new()),
            Box::new(techcrunch::TechCrunchParser::new()),
        ];
        
        for parser in parsers {
            let parser_name = parser.name().to_string();
            info!("Scraping {}...", parser_name);
            
            match self.scrape_site(parser).await {
                Ok(count) => {
                    info!("Found {} new articles from {}", count, parser_name);
                    results.new_articles += count;
                }
                Err(e) => {
                    let error_msg = format!("Error scraping {}: {}", parser_name, e);
                    warn!("{}", error_msg);
                    results.errors.push(error_msg);
                }
            }
        }
        
        Ok(results)
    }
    
    async fn scrape_site(&self, parser: Box<dyn Parser>) -> Result<usize> {
        let mut new_count = 0;
        
        // Step 1: Get listing page and extract article URLs
        info!("Fetching listing page for {}...", parser.name());
        let listing_items = parser.parse_listing().await?;
        info!("Found {} items on listing page", listing_items.len());
        
        // Step 2: Process each article
        for item in listing_items.iter().take(10) {  // Limit to 10 most recent
            // Check if already scraped
            if self.storage.article_exists(&item.url).await? {
                info!("Article already exists: {}", item.url);
                continue;
            }
            
            // Step 3: Scrape full article page
            info!("Scraping article: {}", item.title);
            match parser.parse_article(&item.url).await {
                Ok(scraped) => {
                    // Create article
                    let article = Article::new(parser.name(), &item.url, scraped);
                    
                    // Save to storage
                    self.storage.save_article(&article).await?;
                    new_count += 1;
                    
                    info!("Saved article: {}", article.title);
                }
                Err(e) => {
                    warn!("Failed to scrape article {}: {}", item.url, e);
                }
            }
        }
        
        Ok(new_count)
    }
}
