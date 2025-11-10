use anyhow::{Result, anyhow};
use std::sync::Arc;
use tracing::info;
use chrono::Utc;
use serde::Serialize;
use aws_sdk_cloudfront::Client as CloudFrontClient;
use aws_sdk_cloudfront::types::{InvalidationBatch, Paths};
use uuid::Uuid;

use crate::models::ArticleStatus;
use crate::storage::Storage;
use crate::html_generator::HtmlGenerator;

pub struct Publisher {
    storage: Arc<Storage>,
    generator: HtmlGenerator,
    cloudfront: Option<CloudFrontClient>,
    staging_distribution_id: Option<String>,
    production_distribution_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub timestamp: String,
    pub path: String,
    pub created_at: i64,
}

impl Publisher {
    pub fn new(storage: Arc<Storage>) -> Self {
        Self {
            storage,
            generator: HtmlGenerator::new(),
            cloudfront: None,
            staging_distribution_id: None,
            production_distribution_id: None,
        }
    }
    
    pub fn with_cloudfront(
        mut self,
        cloudfront: CloudFrontClient,
        staging_dist_id: String,
        production_dist_id: String,
    ) -> Self {
        self.cloudfront = Some(cloudfront);
        self.staging_distribution_id = Some(staging_dist_id);
        self.production_distribution_id = Some(production_dist_id);
        self
    }
    
    /// Publish article PDP to staging (only this article, not PLP)
    pub async fn publish_article_to_staging(&self, article_id: &str, admin_user: &str) -> Result<String> {
        info!("Publishing article PDP {} to staging", article_id);
        
        let mut article = self.storage.get_article(article_id).await?
            .ok_or_else(|| anyhow!("Article not found"))?;
        
        // Generate ONLY PDP (Product Detail Page) HTML for all languages
        // Do NOT regenerate PLP - that's a separate operation
        for lang in &["en", "es", "uk"] {
            let html = self.generator.generate_article_html(&article, lang)?;
            let key = format!("staging/articles/{}-{}.html", article.id, lang);
            self.storage.upload_html(&key, html.as_bytes()).await?;
            info!("Generated staging PDP: {}", key);
        }
        
        // Update article metadata
        article.status = ArticleStatus::Staged;
        article.publishing.staged_at = Some(Utc::now().timestamp());
        article.publishing.staged_by = Some(admin_user.to_string());
        article.publishing.staging_url = Some(format!(
            "https://staging.yourdomain.com/articles/{}-en.html",
            article.id
        ));
        
        self.storage.save_article(&article).await?;
        
        info!("Article PDP published to staging: {}", article.publishing.staging_url.as_ref().unwrap());
        Ok(article.publishing.staging_url.unwrap())
    }
    
    /// Publish PLP (listing page) to staging
    /// Call this separately when article list/order changes
    pub async fn publish_plp_to_staging(&self) -> Result<()> {
        info!("Publishing PLP to staging");
        
        let articles = self.storage.list_published_articles().await?;
        
        // Generate PLP for all languages
        for lang in &["en", "es", "uk"] {
            let html = self.generator.generate_listing_html(&articles, lang)?;
            let key = format!("staging/index-{}.html", lang);
            self.storage.upload_html(&key, html.as_bytes()).await?;
            info!("Generated staging PLP: {}", key);
        }
        
        // Also create default index.html (English)
        let html = self.generator.generate_listing_html(&articles, "en")?;
        self.storage.upload_html("staging/index.html", html.as_bytes()).await?;
        
        Ok(())
    }
    
    /// Publish article PDP to production (with automatic backup)
    /// Only publishes this specific article, not PLP
    pub async fn publish_article_to_production(&self, article_id: &str, admin_user: &str) -> Result<()> {
        info!("Publishing article PDP {} to production", article_id);
        
        let mut article = self.storage.get_article(article_id).await?
            .ok_or_else(|| anyhow!("Article not found"))?;
        
        // 1. Backup ONLY this article's PDPs (not entire production)
        let backup_path = self.backup_article_pdp(&article.id).await?;
        info!("Created article backup: {}", backup_path);
        
        // 2. Copy staging PDPs to production (only this article)
        self.promote_article_staging_to_production(&article.id).await?;
        
        // 3. Update article metadata
        article.status = ArticleStatus::Published;
        article.publishing.published_at = Some(Utc::now().timestamp());
        article.publishing.published_by = Some(admin_user.to_string());
        article.publishing.production_url = Some(format!(
            "https://yourdomain.com/articles/{}-en.html",
            article.id
        ));
        article.publishing.version += 1;
        
        self.storage.save_article(&article).await?;
        
        // 4. Invalidate CloudFront cache (only this article)
        self.invalidate_production_cache(&format!("articles/{}*", article.id)).await?;
        
        info!("Article PDP published to production (version {})", article.publishing.version);
        Ok(())
    }
    
    /// Publish PLP to production (with automatic backup)
    /// Call this separately when article list/order changes
    pub async fn publish_plp_to_production(&self) -> Result<()> {
        info!("Publishing PLP to production");
        
        // 1. Backup current PLP
        let backup_path = self.backup_plp().await?;
        info!("Created PLP backup: {}", backup_path);
        
        // 2. Copy staging PLP to production
        self.promote_plp_staging_to_production().await?;
        
        // 3. Invalidate CloudFront cache (only PLP)
        self.invalidate_production_cache("index*").await?;
        
        info!("PLP published to production");
        Ok(())
    }
    
    /// Backup current production to timestamped folder
    async fn backup_production(&self) -> Result<String> {
        let timestamp = Utc::now().format("%Y-%m-%d-%H-%M").to_string();
        let backup_prefix = format!("backups/{}/", timestamp);
        
        info!("Creating backup: {}", backup_prefix);
        
        // Copy production files to backup
        // Note: This is a simplified version. In production, you'd list and copy all files
        self.storage.copy_s3_prefix("production/", &backup_prefix).await?;
        
        Ok(backup_prefix)
    }
    
    /// Backup ONLY this article's PDPs (modular backup)
    async fn backup_article_pdp(&self, article_id: &str) -> Result<String> {
        let timestamp = Utc::now().format("%Y-%m-%d-%H-%M").to_string();
        let backup_prefix = format!("backups/articles/{}/{}/", article_id, timestamp);
        
        info!("Creating article PDP backup: {}", backup_prefix);
        
        // Backup only this article's PDPs
        for lang in &["en", "es", "uk"] {
            let production_key = format!("production/articles/{}-{}.html", article_id, lang);
            let backup_key = format!("{}{}-{}.html", backup_prefix, article_id, lang);
            
            // Copy if exists (might be new article)
            if let Ok(_) = self.storage.copy_s3_file(&production_key, &backup_key).await {
                info!("Backed up: {}", production_key);
            }
        }
        
        Ok(backup_prefix)
    }
    
    /// Backup ONLY PLP files (modular backup)
    async fn backup_plp(&self) -> Result<String> {
        let timestamp = Utc::now().format("%Y-%m-%d-%H-%M").to_string();
        let backup_prefix = format!("backups/plp/{}/", timestamp);
        
        info!("Creating PLP backup: {}", backup_prefix);
        
        // Backup all PLP files
        for lang in &["en", "es", "uk"] {
            let production_key = format!("production/index-{}.html", lang);
            let backup_key = format!("{}index-{}.html", backup_prefix, lang);
            
            if let Ok(_) = self.storage.copy_s3_file(&production_key, &backup_key).await {
                info!("Backed up: {}", production_key);
            }
        }
        
        // Backup default index.html
        self.storage.copy_s3_file("production/index.html", &format!("{}index.html", backup_prefix)).await?;
        
        Ok(backup_prefix)
    }
    
    /// Copy staging article PDPs to production (modular promotion)
    async fn promote_article_staging_to_production(&self, article_id: &str) -> Result<()> {
        info!("Promoting article PDP {} from staging to production", article_id);
        
        // Copy ONLY this article's PDPs
        for lang in &["en", "es", "uk"] {
            let staging_key = format!("staging/articles/{}-{}.html", article_id, lang);
            let production_key = format!("production/articles/{}-{}.html", article_id, lang);
            
            self.storage.copy_s3_file(&staging_key, &production_key).await?;
            info!("Promoted: {} → {}", staging_key, production_key);
        }
        
        Ok(())
    }
    
    /// Copy staging PLP to production (modular promotion)
    async fn promote_plp_staging_to_production(&self) -> Result<()> {
        info!("Promoting PLP from staging to production");
        
        // Copy all PLP files
        for lang in &["en", "es", "uk"] {
            let staging_key = format!("staging/index-{}.html", lang);
            let production_key = format!("production/index-{}.html", lang);
            
            self.storage.copy_s3_file(&staging_key, &production_key).await?;
            info!("Promoted: {} → {}", staging_key, production_key);
        }
        
        // Copy default index.html
        self.storage.copy_s3_file("staging/index.html", "production/index.html").await?;
        
        Ok(())
    }
    

    
    /// Rollback to previous version
    pub async fn rollback(&self, backup_timestamp: Option<String>) -> Result<()> {
        let backup_prefix = if let Some(ts) = backup_timestamp {
            format!("backups/{}/", ts)
        } else {
            // Get latest backup
            let backups = self.list_backups().await?;
            backups.first()
                .ok_or_else(|| anyhow!("No backups available"))?
                .path.clone()
        };
        
        info!("Rolling back to: {}", backup_prefix);
        
        // Copy backup to production
        self.storage.copy_s3_prefix(&backup_prefix, "production/").await?;
        
        // Invalidate CloudFront cache
        self.invalidate_production_cache("/*").await?;
        
        info!("Rollback completed");
        Ok(())
    }
    
    /// List available backups
    pub async fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        info!("Listing available backups");
        
        let backups = self.storage.list_s3_prefixes("backups/").await?;
        
        let mut backup_infos: Vec<BackupInfo> = backups.into_iter()
            .filter(|p| !p.contains("latest"))
            .map(|path| {
                let timestamp = path.replace("backups/", "").replace("/", "");
                BackupInfo {
                    timestamp: timestamp.clone(),
                    path: path.clone(),
                    created_at: self.parse_timestamp(&timestamp).unwrap_or(0),
                }
            })
            .collect();
        
        // Sort by timestamp (newest first)
        backup_infos.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        
        Ok(backup_infos)
    }
    
    fn parse_timestamp(&self, timestamp: &str) -> Result<i64> {
        // Parse format: 2024-11-08-14-30
        let parts: Vec<&str> = timestamp.split('-').collect();
        if parts.len() != 5 {
            return Ok(0);
        }
        
        let datetime_str = format!(
            "{}-{}-{}T{}:{}:00Z",
            parts[0], parts[1], parts[2], parts[3], parts[4]
        );
        
        Ok(chrono::DateTime::parse_from_rfc3339(&datetime_str)
            .map(|dt| dt.timestamp())
            .unwrap_or(0))
    }
    
    /// Invalidate CloudFront cache for production
    async fn invalidate_production_cache(&self, path: &str) -> Result<()> {
        if let (Some(cloudfront), Some(dist_id)) = (&self.cloudfront, &self.production_distribution_id) {
            info!("Invalidating CloudFront cache for: {}", path);
            
            let paths = Paths::builder()
                .quantity(1)
                .items(format!("/{}", path))
                .build()
                .map_err(|e| anyhow!("Failed to build paths: {}", e))?;
            
            let batch = InvalidationBatch::builder()
                .paths(paths)
                .caller_reference(Uuid::new_v4().to_string())
                .build()
                .map_err(|e| anyhow!("Failed to build invalidation batch: {}", e))?;
            
            cloudfront
                .create_invalidation()
                .distribution_id(dist_id)
                .invalidation_batch(batch)
                .send()
                .await?;
            
            info!("CloudFront cache invalidated");
        } else {
            info!("CloudFront not configured, skipping cache invalidation");
        }
        
        Ok(())
    }
    
    /// Generate and upload HTML for all published articles (legacy/bulk method)
    /// Use this for initial setup or bulk regeneration
    #[allow(dead_code)]
    pub async fn publish_all(&self) -> Result<()> {
        info!("Starting bulk HTML generation for published articles...");
        
        let articles = self.storage.list_published_articles().await?;
        info!("Found {} published articles", articles.len());
        
        // Publish all article PDPs
        for article in &articles {
            self.publish_article_to_production(&article.id, "system").await?;
        }
        
        // Publish PLP
        self.publish_plp_to_production().await?;
        
        // Upload CSS
        let css = self.generator.generate_stylesheet();
        self.storage.upload_html("production/static/styles.css", css.as_bytes()).await?;
        
        info!("Bulk HTML generation completed successfully");
        Ok(())
    }
}
