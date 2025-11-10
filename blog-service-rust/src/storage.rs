use anyhow::Result;
use aws_sdk_dynamodb::Client as DynamoClient;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_dynamodb::types::AttributeValue;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Article {
    pub id: String,
    pub source: String,
    pub source_url: String,
    pub title: String,
    pub author: String,
    pub published_date: String,
    pub scraped_at: i64,
    pub status: String,
    pub content: ArticleContent,
    pub translations: Option<Translations>,
    pub metadata: ArticleMetadata,
    #[serde(default)]
    pub publishing: PublishingMetadata,
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
    pub edited: bool,
    pub edited_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PublishingMetadata {
    pub staged_at: Option<i64>,
    pub staged_by: Option<String>,
    pub published_at: Option<i64>,
    pub published_by: Option<String>,
    pub staging_url: Option<String>,
    pub production_url: Option<String>,
    pub version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticleMetadata {
    pub word_count: usize,
    pub reading_time: String,
    pub tags: Vec<String>,
}

pub struct Storage {
    dynamo: DynamoClient,
    s3: S3Client,
    table_name: String,
    bucket_name: String,
}

impl Storage {
    pub fn new(
        dynamo: DynamoClient,
        s3: S3Client,
        table_name: String,
        bucket_name: String,
    ) -> Self {
        Self {
            dynamo,
            s3,
            table_name,
            bucket_name,
        }
    }
    
    pub async fn get_article(&self, id: &str) -> Result<Option<Article>> {
        let result = self.dynamo
            .get_item()
            .table_name(&self.table_name)
            .key("id", AttributeValue::S(id.to_string()))
            .send()
            .await?;
        
        if let Some(item) = result.item() {
            Ok(Some(self.item_to_article(item)?))
        } else {
            Ok(None)
        }
    }
    
    pub async fn list_articles(&self, status: Option<&str>) -> Result<Vec<Article>> {
        let mut scan = self.dynamo
            .scan()
            .table_name(&self.table_name);
        
        if let Some(status) = status {
            scan = scan
                .filter_expression("#status = :status")
                .expression_attribute_names("#status", "status")
                .expression_attribute_values(":status", AttributeValue::S(status.to_string()));
        }
        
        let result = scan.send().await?;
        
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
    
    pub async fn update_article(&self, article: &Article) -> Result<()> {
        let item = self.article_to_item(article)?;
        
        self.dynamo
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(())
    }
    
    pub async fn delete_article(&self, id: &str) -> Result<()> {
        self.dynamo
            .delete_item()
            .table_name(&self.table_name)
            .key("id", AttributeValue::S(id.to_string()))
            .send()
            .await?;
        
        Ok(())
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
