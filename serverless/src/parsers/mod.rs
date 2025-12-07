use anyhow::{Context, Result};
use async_trait::async_trait;
use reqwest::Client;
use scraper::{ElementRef, Html, Selector};

use crate::models::{ListingItem, ScrapedArticle};
use serde::Serialize;

pub mod openai_product_releases;
pub mod openai_security;

pub(crate) const OPENAI_BASE: &str = "https://openai.com";
pub(crate) const OPENAI_PRODUCT_RELEASES_LISTING: &str =
    "https://openai.com/news/product-releases/?display=list";
pub(crate) const OPENAI_SECURITY_LISTING: &str = "https://openai.com/news/security/?display=list";
pub(crate) const OPENAI_RESEARCH_LISTING: &str = "https://openai.com/news/research/?display=list";
pub(crate) const OPENAI_COMPANY_ANNOUNCEMENTS_LISTING: &str =
    "https://openai.com/news/company-announcements/?display=list";
pub(crate) const OPENAI_ENGINEERING_LISTING: &str =
    "https://openai.com/news/engineering/?display=list";
pub(crate) const OPENAI_SAFETY_ALIGNMENT_LISTING: &str =
    "https://openai.com/news/safety-alignment/?display=list";

#[derive(Debug, Clone, Serialize)]
pub struct Article {
    pub category: String,
    pub date_text: String,
    pub date_iso: Option<String>,
    pub title: String,
    pub summary: String,
    pub url: String,
}

#[async_trait]
pub trait Parser: Send + Sync {
    fn name(&self) -> &str;
    async fn parse_listing(&self) -> Result<Vec<ListingItem>>;
    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle>;
}

/// Generic parser for OpenAI news list pages (e.g. /news/product-releases/?display=list).
pub fn parse_openai_news_list(html: &str, base_url: &str) -> Vec<Article> {
    let document = Html::parse_document(html);

    let rows_sel = Selector::parse("div.grid > div.py-md").unwrap();
    let meta_sel = Selector::parse("div.text-meta").unwrap();
    let title_sel = Selector::parse(".text-h5").unwrap();
    let summary_sel = Selector::parse("p.text-p2").unwrap();
    let time_sel = Selector::parse("time").unwrap();
    let link_sel = Selector::parse("a[href]").unwrap();
    let first_div_sel = Selector::parse("div").unwrap();

    let mut out = Vec::new();

    for row in document.select(&rows_sel) {
        let Some(meta) = row.select(&meta_sel).next() else {
            continue;
        };

        let category = meta
            .select(&first_div_sel)
            .next()
            .map(|d| d.text().collect::<String>())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        let time_el = meta.select(&time_sel).next();
        let date_text = time_el
            .as_ref()
            .map(|t| t.text().collect::<String>())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        let date_iso = time_el
            .and_then(|t| t.value().attr("datetime"))
            .map(|s| s.to_string());

        let Some(link) = row.select(&link_sel).next() else {
            continue;
        };
        let Some(href) = link.value().attr("href") else {
            continue;
        };

        let url = if href.starts_with("http://") || href.starts_with("https://") {
            href.to_string()
        } else {
            format!("{}{}", base_url.trim_end_matches('/'), href)
        };

        let title = link
            .select(&title_sel)
            .next()
            .map(|h| h.text().collect::<String>())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if title.is_empty() {
            continue;
        }

        let summary = link
            .select(&summary_sel)
            .next()
            .map(|p| p.text().collect::<String>())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        out.push(Article {
            category,
            date_text,
            date_iso,
            title,
            summary,
            url,
        });
    }

    out
}

pub(crate) async fn parse_openai_listing(
    client: &Client,
    listing_url: &str,
    _parser_name: &str,
) -> Result<Vec<ListingItem>> {
    let html = client.get(listing_url).send().await?.text().await?;
    parse_openai_listing_html(&html)
}

pub(crate) fn parse_openai_listing_html(html: &str) -> Result<Vec<ListingItem>> {
    let document = Html::parse_document(html);

    let link_selector = Selector::parse("a[href^=\"/news/\"]").unwrap();
    let title_selector = Selector::parse("h3, h2, .text-base, .text-lg").unwrap();

    let mut items = Vec::new();

    for link in document.select(&link_selector) {
        if let Some(href) = link.value().attr("href") {
            let url = absolute_url(OPENAI_BASE, href);
            let title = link
                .select(&title_selector)
                .next()
                .map(|t| t.text().collect::<String>())
                .filter(|t| !t.trim().is_empty())
                .unwrap_or_else(|| link.text().collect::<String>());

            let title = title.trim().to_string();
            if title.is_empty() {
                continue;
            }

            items.push(ListingItem {
                url,
                title,
                category: String::new(),
                date_text: String::new(),
            });
        }
    }

    Ok(items)
}

pub(crate) async fn parse_openai_article(
    client: &Client,
    url: &str,
    _parser_name: &str,
) -> Result<ScrapedArticle> {
    let html = client.get(url).send().await?.text().await?;
    parse_openai_article_html(&html)
}

pub(crate) fn parse_openai_article_html(html: &str) -> Result<ScrapedArticle> {
    let document = Html::parse_document(html);

    let title_selector = Selector::parse("h1").unwrap();
    let title = document
        .select(&title_selector)
        .next()
        .map(|t| t.text().collect::<String>())
        .unwrap_or_else(|| "Untitled".to_string());

    let date_selector = Selector::parse("time").unwrap();
    let published_date = document
        .select(&date_selector)
        .next()
        .and_then(|d| d.value().attr("datetime"))
        .unwrap_or("Unknown")
        .to_string();

    let content_selector = Selector::parse("article, main").unwrap();
    let content_element = document
        .select(&content_selector)
        .next()
        .context("No content found")?;
    let content_html = content_element.html();
    let content_text = extract_text(&content_element);

    let images_selector = Selector::parse("article img").unwrap();
    let images: Vec<String> = content_element
        .select(&images_selector)
        .filter_map(|img| img.value().attr("src"))
        .map(|src| absolute_url(OPENAI_BASE, src))
        .collect();

    let article = ScrapedArticle {
        title: title.trim().to_string(),
        author: "OpenAI".to_string(),
        published_date,
        content_html,
        content_text,
        images,
    };

    Ok(article)
}

pub(crate) fn absolute_url(base: &str, url: &str) -> String {
    if url.starts_with("http") {
        url.to_string()
    } else if url.starts_with("//") {
        format!("https:{}", url)
    } else if url.starts_with('/') {
        format!("{}{}", base.trim_end_matches('/'), url)
    } else {
        format!("{}/{}", base.trim_end_matches('/'), url)
    }
}

pub(crate) fn extract_text(element: &ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
