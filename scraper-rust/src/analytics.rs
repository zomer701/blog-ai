// Analytics tracking and reporting
use anyhow::Result;
use aws_sdk_dynamodb::Client;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsEvent {
    pub article_id: String,
    pub event_type: String, // "view", "click", "share"
    pub timestamp: String,
    pub user_agent: Option<String>,
    pub referrer: Option<String>,
    pub country: Option<String>,
    pub device_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ArticleStats {
    pub article_id: String,
    pub total_views: u32,
    pub unique_visitors: u32,
    pub avg_time_on_page: f32,
}

#[derive(Debug, Serialize)]
pub struct PopularArticle {
    pub article_id: String,
    pub title: String,
    pub views: u32,
    pub source: String,
}

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_articles: u32,
    pub published_articles: u32,
    pub pending_articles: u32,
    pub total_views: u32,
    pub views_today: u32,
    pub popular_articles: Vec<PopularArticle>,
}

pub struct AnalyticsTracker {
    dynamodb_client: Client,
    analytics_table: String,
    articles_table: String,
}

impl AnalyticsTracker {
    pub fn new(dynamodb_client: Client, analytics_table: String, articles_table: String) -> Self {
        Self {
            dynamodb_client,
            analytics_table,
            articles_table,
        }
    }

    pub async fn track_event(&self, event: AnalyticsEvent) -> Result<()> {
        use aws_sdk_dynamodb::types::AttributeValue;

        self.dynamodb_client
            .put_item()
            .table_name(&self.analytics_table)
            .item("article_id", AttributeValue::S(event.article_id.clone()))
            .item("timestamp", AttributeValue::S(event.timestamp.clone()))
            .item("event_type", AttributeValue::S(event.event_type.clone()))
            .item("user_agent", AttributeValue::S(event.user_agent.unwrap_or_default()))
            .item("referrer", AttributeValue::S(event.referrer.unwrap_or_default()))
            .item("country", AttributeValue::S(event.country.unwrap_or_default()))
            .item("device_type", AttributeValue::S(event.device_type.unwrap_or_default()))
            .send()
            .await?;

        Ok(())
    }

    pub async fn get_article_stats(&self, article_id: &str) -> Result<ArticleStats> {
        use aws_sdk_dynamodb::types::AttributeValue;

        let result = self.dynamodb_client
            .query()
            .table_name(&self.analytics_table)
            .key_condition_expression("article_id = :article_id")
            .expression_attribute_values(":article_id", AttributeValue::S(article_id.to_string()))
            .send()
            .await?;

        let total_views = result.count() as u32;
        
        // For simplicity, unique visitors = total views * 0.7
        let unique_visitors = (total_views as f32 * 0.7) as u32;
        
        Ok(ArticleStats {
            article_id: article_id.to_string(),
            total_views,
            unique_visitors,
            avg_time_on_page: 120.0, // Mock: 2 minutes average
        })
    }

    pub async fn get_popular_articles(&self, days: u32) -> Result<Vec<PopularArticle>> {
        // Mock implementation - in production, aggregate from analytics table
        Ok(vec![
            PopularArticle {
                article_id: "1".to_string(),
                title: "Introduction to GPT-4".to_string(),
                views: 1250,
                source: "testai".to_string(),
            },
            PopularArticle {
                article_id: "2".to_string(),
                title: "New AI Models Released".to_string(),
                views: 980,
                source: "HuggingFace".to_string(),
            },
            PopularArticle {
                article_id: "3".to_string(),
                title: "AI in Healthcare".to_string(),
                views: 750,
                source: "TechCrunch".to_string(),
            },
        ])
    }

    pub async fn get_dashboard_stats(&self) -> Result<DashboardStats> {
        // Get article counts
        let articles_result = self.dynamodb_client
            .scan()
            .table_name(&self.articles_table)
            .send()
            .await?;

        let total_articles = articles_result.count() as u32;
        
        // Count by status (simplified)
        let mut published_articles = 0;
        let mut pending_articles = 0;

        if let Some(items) = articles_result.items {
            for item in items {
                if let Some(status) = item.get("status").and_then(|v| v.as_s().ok()) {
                    match status.as_str() {
                        "published" => published_articles += 1,
                        "translated" | "scraped" => pending_articles += 1,
                        _ => {}
                    }
                }
            }
        }

        // Get popular articles
        let popular_articles = self.get_popular_articles(7).await?;

        Ok(DashboardStats {
            total_articles,
            published_articles,
            pending_articles,
            total_views: 5420, // Mock data
            views_today: 234,   // Mock data
            popular_articles,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analytics_event_creation() {
        let event = AnalyticsEvent {
            article_id: "test-123".to_string(),
            event_type: "view".to_string(),
            timestamp: Utc::now().to_rfc3339(),
            user_agent: Some("Mozilla/5.0".to_string()),
            referrer: None,
            country: Some("US".to_string()),
            device_type: Some("desktop".to_string()),
        };

        assert_eq!(event.article_id, "test-123");
        assert_eq!(event.event_type, "view");
    }
}
