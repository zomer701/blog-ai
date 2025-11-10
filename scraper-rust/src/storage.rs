use anyhow::Result;
use aws_sdk_dynamodb::Client as DynamoClient;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;

use crate::config::Config;
use crate::models::Article;

pub struct Storage {
    dynamo: DynamoClient,
    #[allow(dead_code)]
    s3: S3Client,
    config: Config,
}

impl Storage {
    pub fn new(aws_config: &aws_config::SdkConfig, config: &Config) -> Self {
        Self {
            dynamo: DynamoClient::new(aws_config),
            s3: S3Client::new(aws_config),
            config: config.clone(),
        }
    }
    
    pub async fn article_exists(&self, url: &str) -> Result<bool> {
        let article_id = Self::generate_id(url);
        
        let result = self.dynamo
            .get_item()
            .table_name(&self.config.table_name)
            .key("id", AttributeValue::S(article_id))
            .send()
            .await?;
        
        Ok(result.item().is_some())
    }
    
    pub async fn save_article(&self, article: &Article) -> Result<()> {
        let item = self.article_to_item(article)?;
        
        self.dynamo
            .put_item()
            .table_name(&self.config.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(())
    }
    
    #[allow(dead_code)]
    pub async fn get_article(&self, id: &str) -> Result<Option<Article>> {
        let result = self.dynamo
            .get_item()
            .table_name(&self.config.table_name)
            .key("id", AttributeValue::S(id.to_string()))
            .send()
            .await?;
        
        if let Some(item) = result.item() {
            Ok(Some(self.item_to_article(item)?))
        } else {
            Ok(None)
        }
    }
    
    #[allow(dead_code)]
    pub async fn list_pending_articles(&self) -> Result<Vec<Article>> {
        let result = self.dynamo
            .scan()
            .table_name(&self.config.table_name)
            .filter_expression("#status = :status")
            .expression_attribute_names("#status", "status")
            .expression_attribute_values(":status", AttributeValue::S("pending".to_string()))
            .send()
            .await?;
        
        let mut articles = Vec::new();
        if let Some(items) = result.items {
            for item in items {
                if let Ok(article) = self.item_to_article(&item) {
                    articles.push(article);
                }
            }
        }
        
        Ok(articles)
    }
    
    #[allow(dead_code)]
    pub async fn update_article_status(&self, id: &str, status: &str) -> Result<()> {
        self.dynamo
            .update_item()
            .table_name(&self.config.table_name)
            .key("id", AttributeValue::S(id.to_string()))
            .update_expression("SET #status = :status")
            .expression_attribute_names("#status", "status")
            .expression_attribute_values(":status", AttributeValue::S(status.to_string()))
            .send()
            .await?;
        
        Ok(())
    }
    
    pub async fn list_published_articles(&self) -> Result<Vec<Article>> {
        let result = self.dynamo
            .scan()
            .table_name(&self.config.table_name)
            .filter_expression("#status = :status")
            .expression_attribute_names("#status", "status")
            .expression_attribute_values(":status", AttributeValue::S("published".to_string()))
            .send()
            .await?;
        
        let mut articles = Vec::new();
        if let Some(items) = result.items {
            for item in items {
                if let Ok(article) = self.item_to_article(&item) {
                    articles.push(article);
                }
            }
        }
        
        Ok(articles)
    }
    
    pub async fn upload_html(&self, key: &str, data: &[u8]) -> Result<String> {
        self.s3
            .put_object()
            .bucket(&self.config.bucket_name)
            .key(key)
            .body(data.to_vec().into())
            .content_type("text/html")
            .send()
            .await?;
        
        Ok(format!("s3://{}/{}", self.config.bucket_name, key))
    }
    
    /// Copy S3 file from one key to another
    pub async fn copy_s3_file(&self, source_key: &str, dest_key: &str) -> Result<()> {
        self.s3
            .copy_object()
            .bucket(&self.config.bucket_name)
            .copy_source(format!("{}/{}", self.config.bucket_name, source_key))
            .key(dest_key)
            .send()
            .await?;
        
        Ok(())
    }
    
    /// Copy all files with a prefix to another prefix
    pub async fn copy_s3_prefix(&self, source_prefix: &str, dest_prefix: &str) -> Result<()> {
        let objects = self.s3
            .list_objects_v2()
            .bucket(&self.config.bucket_name)
            .prefix(source_prefix)
            .send()
            .await?;
        
        if let Some(contents) = objects.contents {
            for object in contents {
                if let Some(key) = object.key {
                    let new_key = key.replace(source_prefix, dest_prefix);
                    self.copy_s3_file(&key, &new_key).await?;
                }
            }
        }
        
        Ok(())
    }
    
    /// List S3 prefixes (directories)
    pub async fn list_s3_prefixes(&self, prefix: &str) -> Result<Vec<String>> {
        let objects = self.s3
            .list_objects_v2()
            .bucket(&self.config.bucket_name)
            .prefix(prefix)
            .delimiter("/")
            .send()
            .await?;
        
        let mut prefixes = Vec::new();
        if let Some(common_prefixes) = objects.common_prefixes {
            for cp in common_prefixes {
                if let Some(p) = cp.prefix {
                    prefixes.push(p);
                }
            }
        }
        
        Ok(prefixes)
    }
    
    #[allow(dead_code)]
    pub async fn upload_image(&self, key: &str, data: &[u8], content_type: &str) -> Result<String> {
        self.s3
            .put_object()
            .bucket(&self.config.bucket_name)
            .key(key)
            .body(data.to_vec().into())
            .content_type(content_type)
            .send()
            .await?;
        
        Ok(format!("s3://{}/{}", self.config.bucket_name, key))
    }
    
    fn generate_id(url: &str) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(url.as_bytes());
        format!("{:x}", hasher.finalize())
    }
    
    fn article_to_item(&self, article: &Article) -> Result<HashMap<String, AttributeValue>> {
        let json = serde_json::to_string(article)?;
        let map: HashMap<String, serde_json::Value> = serde_json::from_str(&json)?;
        
        let mut item = HashMap::new();
        for (key, value) in map {
            item.insert(key, self.json_to_attribute_value(value));
        }
        
        Ok(item)
    }
    
    #[allow(dead_code)]
    fn item_to_article(&self, item: &HashMap<String, AttributeValue>) -> Result<Article> {
        let mut map = HashMap::new();
        for (key, value) in item {
            map.insert(key.clone(), self.attribute_value_to_json(value));
        }
        
        let json = serde_json::to_string(&map)?;
        let article: Article = serde_json::from_str(&json)?;
        
        Ok(article)
    }
    
    fn json_to_attribute_value(&self, value: serde_json::Value) -> AttributeValue {
        match value {
            serde_json::Value::String(s) => AttributeValue::S(s),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    AttributeValue::N(i.to_string())
                } else {
                    AttributeValue::N(n.to_string())
                }
            }
            serde_json::Value::Bool(b) => AttributeValue::Bool(b),
            serde_json::Value::Array(arr) => {
                let items: Vec<AttributeValue> = arr.into_iter()
                    .map(|v| self.json_to_attribute_value(v))
                    .collect();
                AttributeValue::L(items)
            }
            serde_json::Value::Object(obj) => {
                let mut map = HashMap::new();
                for (k, v) in obj {
                    map.insert(k, self.json_to_attribute_value(v));
                }
                AttributeValue::M(map)
            }
            serde_json::Value::Null => AttributeValue::Null(true),
        }
    }
    
    #[allow(dead_code)]
    fn attribute_value_to_json(&self, value: &AttributeValue) -> serde_json::Value {
        match value {
            AttributeValue::S(s) => serde_json::Value::String(s.clone()),
            AttributeValue::N(n) => {
                if let Ok(i) = n.parse::<i64>() {
                    serde_json::Value::Number(i.into())
                } else {
                    serde_json::Value::String(n.clone())
                }
            }
            AttributeValue::Bool(b) => serde_json::Value::Bool(*b),
            AttributeValue::L(list) => {
                let arr: Vec<serde_json::Value> = list.iter()
                    .map(|v| self.attribute_value_to_json(v))
                    .collect();
                serde_json::Value::Array(arr)
            }
            AttributeValue::M(map) => {
                let mut obj = serde_json::Map::new();
                for (k, v) in map {
                    obj.insert(k.clone(), self.attribute_value_to_json(v));
                }
                serde_json::Value::Object(obj)
            }
            _ => serde_json::Value::Null,
        }
    }
}
