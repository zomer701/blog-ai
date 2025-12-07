use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct Site {
    pub name: String,
    pub top_articles: Option<usize>,
    #[serde(default)]
    pub articles: Vec<String>,
    #[serde(default)]
    pub force: bool,
    /// Optional precomputed listing entries (e.g., from an S3-hosted index.html) to process when a parser is unavailable.
    #[serde(default)]
    pub provided_listing: Vec<ProvidedListingItem>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProvidedListingItem {
    pub url: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub date_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: String,
    pub source: String,
    pub source_url: String,
    pub title: String,
    pub author: String,
    pub published_date: String,
    pub scraped_at: i64,
    pub status: ArticleStatus,
    pub content: ArticleContent,
    pub translations: Option<Translations>,
    pub metadata: ArticleMetadata,
    #[serde(default)]
    pub publishing: PublishingMetadata,
}

impl Default for PublishingMetadata {
    fn default() -> Self {
        Self {
            staged_at: None,
            staged_by: None,
            published_at: None,
            published_by: None,
            staging_url: None,
            production_url: None,
            version: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticleContent {
    pub original_html: String,
    pub text: String,
    pub images: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translations {
    pub es: Translation,
    pub uk: Translation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub title: String,
    pub content: String,
    pub edited: bool, // Track if manually edited
    pub edited_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ArticleStatus {
    Pending,   // Scraped, awaiting review
    Approved,  // Reviewed, ready to stage
    Staged,    // Published to staging (preview)
    Published, // Live on production
    Rejected,  // Rejected by admin
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishingMetadata {
    pub staged_at: Option<i64>,
    pub staged_by: Option<String>,
    pub published_at: Option<i64>,
    pub published_by: Option<String>,
    pub staging_url: Option<String>,
    pub production_url: Option<String>,
    pub version: u32, // Increments on each publish
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticleMetadata {
    pub word_count: usize,
    pub reading_time: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ListingItem {
    pub url: String,
    pub title: String,
    pub category: String,
    pub date_text: String,
}

#[derive(Debug, Clone)]
pub struct ScrapedArticle {
    pub title: String,
    pub author: String,
    pub published_date: String,
    pub content_html: String,
    pub content_text: String,
    pub images: Vec<String>,
}

#[derive(Debug, Default)]
pub struct ScrapeResults {
    pub new_articles: usize,
    pub errors: Vec<String>,
}

impl Article {
    pub fn new(source: &str, source_url: &str, scraped: ScrapedArticle) -> Self {
        let word_count = scraped.content_text.split_whitespace().count();
        let reading_time = format!("{} min", word_count / 200);

        Self {
            id: Uuid::new_v4().to_string(),
            source: source.to_string(),
            source_url: source_url.to_string(),
            title: scraped.title,
            author: scraped.author,
            published_date: scraped.published_date,
            scraped_at: Utc::now().timestamp(),
            status: ArticleStatus::Pending,
            content: ArticleContent {
                original_html: scraped.content_html,
                text: scraped.content_text,
                images: scraped.images,
            },
            translations: None,
            metadata: ArticleMetadata {
                word_count,
                reading_time,
                tags: vec![],
            },
            publishing: PublishingMetadata::default(),
        }
    }
}
