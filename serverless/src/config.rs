use anyhow::Result;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub table_name: String,
    #[allow(dead_code)]
    pub bucket_name: String,
    #[allow(dead_code)]
    pub auto_publish: bool,
    #[allow(dead_code)]
    pub max_articles_per_site: usize,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            table_name: env::var("TABLE_NAME").unwrap_or_else(|_| "ArticlesTable".to_string()),
            bucket_name: env::var("BUCKET_NAME")
                .unwrap_or_else(|_| "blog-content-bucket".to_string()),
            auto_publish: env::var("AUTO_PUBLISH")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            max_articles_per_site: env::var("MAX_ARTICLES_PER_SITE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
        })
    }
}
