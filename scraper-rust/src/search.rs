// Search functionality for articles
use anyhow::Result;
use aws_sdk_dynamodb::Client;
use crate::models::Article;

pub struct SearchEngine {
    dynamodb_client: Client,
    table_name: String,
}

#[derive(Debug, Clone)]
pub struct SearchQuery {
    pub text: Option<String>,
    pub source: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub language: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug)]
pub struct SearchResults {
    pub articles: Vec<Article>,
    pub total: usize,
}

impl SearchEngine {
    pub fn new(dynamodb_client: Client, table_name: String) -> Self {
        Self {
            dynamodb_client,
            table_name,
        }
    }

    pub async fn search(&self, query: SearchQuery) -> Result<SearchResults> {
        // For now, implement a simple scan with filters
        // In production, consider using DynamoDB GSI or ElasticSearch
        
        let mut scan_builder = self.dynamodb_client
            .scan()
            .table_name(&self.table_name);

        // Add filter expressions based on query
        let mut filter_expressions = Vec::new();
        
        if let Some(status) = &query.status {
            filter_expressions.push(format!("#status = :status"));
            scan_builder = scan_builder
                .expression_attribute_names("#status", "status")
                .expression_attribute_values(":status", aws_sdk_dynamodb::types::AttributeValue::S(status.clone()));
        }

        if let Some(source) = &query.source {
            filter_expressions.push(format!("#source = :source"));
            scan_builder = scan_builder
                .expression_attribute_names("#source", "source")
                .expression_attribute_values(":source", aws_sdk_dynamodb::types::AttributeValue::S(source.clone()));
        }

        if !filter_expressions.is_empty() {
            scan_builder = scan_builder.filter_expression(filter_expressions.join(" AND "));
        }

        let result = scan_builder.send().await?;
        
        let mut articles = Vec::new();
        if let Some(items) = result.items {
            for item in items {
                if let Ok(article) = Article::from_dynamodb_item(item) {
                    // Apply text search filter if provided
                    if let Some(text) = &query.text {
                        let text_lower = text.to_lowercase();
                        if article.title.to_lowercase().contains(&text_lower) ||
                           article.content.to_lowercase().contains(&text_lower) {
                            articles.push(article);
                        }
                    } else {
                        articles.push(article);
                    }
                }
            }
        }

        let total = articles.len();

        Ok(SearchResults {
            articles,
            total,
        })
    }
}

impl Article {
    fn from_dynamodb_item(item: std::collections::HashMap<String, aws_sdk_dynamodb::types::AttributeValue>) -> Result<Self> {
        use aws_sdk_dynamodb::types::AttributeValue;
        
        let get_string = |key: &str| -> String {
            item.get(key)
                .and_then(|v| v.as_s().ok())
                .cloned()
                .unwrap_or_default()
        };

        let get_bool = |key: &str| -> bool {
            item.get(key)
                .and_then(|v| v.as_bool().ok())
                .copied()
                .unwrap_or(false)
        };

        Ok(Article {
            id: get_string("id"),
            url: get_string("url"),
            title: get_string("title"),
            content: get_string("content"),
            published_at: get_string("published_at"),
            source: get_string("source"),
            title_es: get_string("title_es"),
            content_es: get_string("content_es"),
            title_uk: get_string("title_uk"),
            content_uk: get_string("content_uk"),
            title_es_edited: get_bool("title_es_edited"),
            content_es_edited: get_bool("content_es_edited"),
            title_uk_edited: get_bool("title_uk_edited"),
            content_uk_edited: get_bool("content_uk_edited"),
            status: get_string("status"),
            created_at: get_string("created_at"),
            updated_at: get_string("updated_at"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_query_creation() {
        let query = SearchQuery {
            text: Some("AI".to_string()),
            source: Some("testai".to_string()),
            date_from: None,
            date_to: None,
            language: None,
            status: Some("published".to_string()),
        };

        assert_eq!(query.text, Some("AI".to_string()));
        assert_eq!(query.source, Some("testai".to_string()));
    }
}
