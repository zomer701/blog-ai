use std::collections::HashMap;

use anyhow::Result;
use aws_sdk_dynamodb::{types::AttributeValue, Client as DynamoClient};
use aws_sdk_s3::Client as S3Client;
use chrono::Utc;
use serde_json;
use sha2::{Digest, Sha256};
use tracing::info;

use crate::config::Config;
use crate::models::ListingItem;

#[derive(Debug, Clone)]
pub struct ArticleMetadataRecord {
    pub id: String,
    pub parser: String,
    pub title: String,
    pub category: String,
    pub date_text: String,
    pub url: String,
    pub html_key: String,
    pub text_key: String,
    pub images_key: String,
    pub images: Vec<String>,
    pub updated_at: i64,
}

impl ArticleMetadataRecord {
    pub fn from_listing(
        parser_name: &str,
        listing: &ListingItem,
        html_key: String,
        text_key: String,
        images_key: String,
        images: Vec<String>,
    ) -> Self {
        Self::new(
            parser_name,
            &listing.title,
            &listing.category,
            &listing.date_text,
            &listing.url,
            html_key,
            text_key,
            images_key,
            images,
        )
    }

    pub fn new(
        parser_name: &str,
        title: &str,
        category: &str,
        date_text: &str,
        url: &str,
        html_key: String,
        text_key: String,
        images_key: String,
        images: Vec<String>,
    ) -> Self {
        let id = generate_id(parser_name, title, category, date_text);

        Self {
            id,
            parser: parser_name.to_string(),
            title: title.to_string(),
            category: category.to_string(),
            date_text: date_text.to_string(),
            url: url.to_string(),
            html_key,
            text_key,
            images_key,
            images,
            updated_at: Utc::now().timestamp(),
        }
    }
}

pub struct Storage {
    dynamo: DynamoClient,
    s3: S3Client,
    table_name: String,
    bucket_name: String,
}

impl Storage {
    pub async fn from_env() -> Result<Self> {
        let config = Config::from_env()?;
        let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
        let dynamo = DynamoClient::new(&aws_config);
        let s3 = S3Client::new(&aws_config);

        Ok(Self {
            dynamo,
            s3,
            table_name: config.table_name,
            bucket_name: config.bucket_name,
        })
    }

    pub async fn save_article_content(
        &self,
        parser_name: &str,
        title: &str,
        category: &str,
        date_text: &str,
        url: &str,
        content_html: &str,
        content_text: &str,
        images: &[String],
    ) -> Result<()> {
        // let id = generate_id(parser_name, title, category, date_text);
        // let slug = {
        //     let candidate = slugify(&format!("{}-{}", category, title));
        //     if candidate.is_empty() {
        //         id.clone()
        //     } else {
        //         candidate
        //     }
        // };
        // let base_prefix = format!("{}/{}", parser_name, slug);

        // let html_key = format!("{}/content.html", base_prefix);
        // let text_key = format!("{}/content.txt", base_prefix);
        // let images_key = format!("{}/images.json", base_prefix);

        // self.upload_string(&html_key, content_html, "text/html")
        //     .await?;
        // self.upload_string(&text_key, content_text, "text/plain")
        //     .await?;

        // let images_payload = serde_json::to_vec(images)?;
        // self.upload_bytes(&images_key, &images_payload, "application/json")
        //     .await?;

        // let metadata = ArticleMetadataRecord::new(
        //     parser_name,
        //     title,
        //     category,
        //     date_text,
        //     url,
        //     html_key.clone(),
        //     text_key.clone(),
        //     images_key.clone(),
        //     images.to_vec(),
        // );

        // self.upsert_article_metadata(&metadata).await
        Ok(())
    }

    async fn upsert_article_metadata(&self, metadata: &ArticleMetadataRecord) -> Result<()> {
        let exists = self.metadata_exists(&metadata.id).await?;

        let mut item = HashMap::new();
        item.insert("id".to_string(), AttributeValue::S(metadata.id.clone()));
        item.insert(
            "parser".to_string(),
            AttributeValue::S(metadata.parser.clone()),
        );
        item.insert(
            "title".to_string(),
            AttributeValue::S(metadata.title.clone()),
        );
        item.insert(
            "category".to_string(),
            AttributeValue::S(metadata.category.clone()),
        );
        item.insert(
            "date_text".to_string(),
            AttributeValue::S(metadata.date_text.clone()),
        );
        item.insert("url".to_string(), AttributeValue::S(metadata.url.clone()));
        item.insert(
            "html_key".to_string(),
            AttributeValue::S(metadata.html_key.clone()),
        );
        item.insert(
            "text_key".to_string(),
            AttributeValue::S(metadata.text_key.clone()),
        );
        item.insert(
            "images_key".to_string(),
            AttributeValue::S(metadata.images_key.clone()),
        );
        item.insert(
            "images".to_string(),
            AttributeValue::L(
                metadata
                    .images
                    .iter()
                    .cloned()
                    .map(AttributeValue::S)
                    .collect(),
            ),
        );
        item.insert(
            "updated_at".to_string(),
            AttributeValue::N(metadata.updated_at.to_string()),
        );

        self.dynamo
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        if exists {
            info!(
                "TAG:DYNAMO_UPSERT updated article metadata id={} parser={} title=\"{}\"",
                metadata.id, metadata.parser, metadata.title
            );
        } else {
            info!(
                "TAG:DYNAMO_UPSERT created article metadata id={} parser={} title=\"{}\"",
                metadata.id, metadata.parser, metadata.title
            );
        }

        Ok(())
    }

    async fn metadata_exists(&self, id: &str) -> Result<bool> {
        let result = self
            .dynamo
            .get_item()
            .table_name(&self.table_name)
            .key("id", AttributeValue::S(id.to_string()))
            .send()
            .await?;

        Ok(result.item().is_some())
    }

    async fn upload_string(&self, key: &str, data: &str, content_type: &str) -> Result<()> {
        self.upload_bytes(key, data.as_bytes(), content_type).await
    }

    async fn upload_bytes(&self, key: &str, data: &[u8], content_type: &str) -> Result<()> {
        self.s3
            .put_object()
            .bucket(&self.bucket_name)
            .key(key)
            .body(data.to_vec().into())
            .content_type(content_type)
            .send()
            .await?;

        Ok(())
    }
}

fn generate_id(parser_name: &str, title: &str, category: &str, date_text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(parser_name.as_bytes());
    hasher.update("|");
    hasher.update(title.as_bytes());
    hasher.update("|");
    hasher.update(category.as_bytes());
    hasher.update("|");
    hasher.update(date_text.as_bytes());

    format!("{:x}", hasher.finalize())
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;

    for c in input.to_ascii_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }

    out.trim_matches('-').to_string()
}
