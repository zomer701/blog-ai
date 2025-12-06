use anyhow::{Context, Result};
use playwright::Playwright;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, info, warn};

use crate::models::{ListingItem, ScrapeResults, Site};
use crate::parsers::{
    parse_openai_article_html, parse_openai_listing_html, parse_openai_news_list, OPENAI_BASE,
};
use crate::storage::Storage;

pub struct PlaywrightCrawlerService {
    storage: Storage,
    crawler: PlaywrightCrawler,
}

impl PlaywrightCrawlerService {
    pub async fn new() -> Result<Self> {
        let storage = Storage::from_env().await?;
        let crawler = PlaywrightCrawler::from_env().await?;
        Ok(Self { storage, crawler })
    }

    pub async fn execute(&self, sites: &[Site]) -> Result<ScrapeResults> {
        let mut results = ScrapeResults::default();

        for site in sites {
            debug!(
                "Preparing Playwright scrape for {} (top_articles: {:?}, provided: {})",
                site.name,
                site.top_articles,
                site.articles.len()
            );

            let Some(parser) = PlaywrightParser::from_site_name(&site.name) else {
                warn!("Playwright parser not implemented for {}", site.name);
                continue;
            };

            if let Some(limit) = site.top_articles {
                let added = self.scrape_top_articles(limit, site.force, &parser).await?;
                results.new_articles += added;
            }

            if !site.articles.is_empty() {
                let added = self.scrape_provided_articles(site, &parser).await?;
                results.new_articles += added;
            }

            if site.top_articles.is_none() && site.articles.is_empty() {
                warn!("No scrape instructions supplied for {}", site.name);
            }
        }

        Ok(results)
    }

    async fn scrape_top_articles(
        &self,
        limit: usize,
        force: bool,
        parser: &PlaywrightParser,
    ) -> Result<usize> {
        let listing = self.fetch_listing(parser).await?;
        let mut processed = 0;

        for item in listing.iter().take(limit) {
            if !force
                && self
                    .storage
                    .article_exists(parser.name(), &item.title, &item.category, &item.date_text)
                    .await?
            {
                info!(
                    "{}: skipping existing article \"{}\" ({})",
                    parser.name(),
                    item.title,
                    item.url
                );
                continue;
            }

            info!(
                "TAG:PLAYWRIGHT_LISTING {}: {} -> {}",
                parser.name(),
                item.title,
                item.url
            );

            let article = self.parse_article(parser, &item.url).await?;

            self.storage
                .save_article_content(
                    parser.name(),
                    &item.title,
                    &item.category,
                    &item.date_text,
                    &item.url,
                    &article.content_html,
                    &article.content_text,
                    &article.images,
                )
                .await?;

            processed += 1;
        }

        Ok(processed)
    }

    async fn scrape_provided_articles(
        &self,
        site: &Site,
        parser: &PlaywrightParser,
    ) -> Result<usize> {
        let mut new_articles = 0;

        for url in &site.articles {
            info!(
                "{}: Playwright scraping provided url {}",
                parser.name(),
                url
            );
            let article = self.parse_article(parser, url).await?;

            self.storage
                .save_article_content(
                    parser.name(),
                    &article.title,
                    "",
                    "",
                    url,
                    &article.content_html,
                    &article.content_text,
                    &article.images,
                )
                .await?;

            new_articles += 1;
        }

        Ok(new_articles)
    }

    async fn fetch_listing(&self, parser: &PlaywrightParser) -> Result<Vec<ListingItem>> {
        let listing_html = self
            .crawler
            .fetch_html(parser.listing_url())
            .await
            .context("failed to fetch listing via Playwright")?;

        let items = match parser {
            PlaywrightParser::OpenAIProductReleases => {
                parse_openai_news_list(&listing_html, OPENAI_BASE)
                    .into_iter()
                    .map(|a| ListingItem {
                        url: a.url,
                        title: a.title,
                        category: a.category,
                        date_text: a.date_text,
                    })
                    .collect()
            }
            PlaywrightParser::OpenAISecurity => parse_openai_listing_html(&listing_html)?,
        };

        Ok(items)
    }

    async fn parse_article(
        &self,
        _parser: &PlaywrightParser,
        url: &str,
    ) -> Result<crate::models::ScrapedArticle> {
        let html = self
            .crawler
            .fetch_html(url)
            .await
            .with_context(|| format!("failed to fetch article via Playwright: {}", url))?;
        parse_openai_article_html(&html)
    }
}

struct PlaywrightCrawler {
    http_client: Client,
    playwright: Option<Playwright>,
    remote_endpoint: Option<String>,
}

impl PlaywrightCrawler {
    async fn from_env() -> Result<Self> {
        // Optional remote Playwright endpoint; preferred for Lambda where local Chrome is unavailable.
        let remote_endpoint = std::env::var("PLAYWRIGHT_CRAWLER_URL")
            .ok()
            .map(|u| u.trim_end_matches('/').to_string());

        // Local Playwright is opt-in to avoid failures on Lambda without Chromium.
        let playwright = match std::env::var("ENABLE_LOCAL_PLAYWRIGHT")
            .ok()
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        {
            Some(true) => Some(
                Playwright::initialize()
                    .await
                    .context("failed to initialize Playwright")?,
            ),
            _ => None,
        };

        let http_client = Client::builder()
            .build()
            .context("failed to build reqwest client for Playwright crawler")?;

        Ok(Self {
            http_client,
            playwright,
            remote_endpoint,
        })
    }

    async fn fetch_html(&self, target_url: &str) -> Result<String> {
        // First try remote Playwright if configured.
        if let Some(endpoint) = &self.remote_endpoint {
            if let Ok(html) =
                fetch_with_remote_playwright(&self.http_client, endpoint, target_url).await
            {
                return Ok(html);
            } else {
                warn!(
                    "Remote Playwright fetch failed for {}; will try local/reqwest fallback",
                    target_url
                );
            }
        }

        // Then try local Playwright if enabled and available.
        if let Some(playwright) = &self.playwright {
            match fetch_with_playwright(playwright, target_url).await {
                Ok(html) => return Ok(html),
                Err(playwright_err) => {
                    warn!(
                        "Local Playwright fetch failed for {}; falling back to reqwest: {}",
                        target_url, playwright_err
                    );
                }
            }
        }

        // Finally, fall back to plain HTTP.
        let res = self
            .http_client
            .get(target_url)
            .send()
            .await
            .context("fallback request failed")?
            .error_for_status()
            .context("fallback returned error status")?;
        let body = res.text().await.context("failed to read fallback body")?;
        Ok(body)
    }
}

#[derive(Clone)]
enum PlaywrightParser {
    OpenAIProductReleases,
    OpenAISecurity,
}

impl PlaywrightParser {
    fn from_site_name(name: &str) -> Option<Self> {
        match name {
            "openai-product-releases" => Some(Self::OpenAIProductReleases),
            "openai-security" => Some(Self::OpenAISecurity),
            _ => None,
        }
    }

    fn name(&self) -> &'static str {
        match self {
            PlaywrightParser::OpenAIProductReleases => "openai-product-releases",
            PlaywrightParser::OpenAISecurity => "openai-security",
        }
    }

    fn listing_url(&self) -> &'static str {
        match self {
            PlaywrightParser::OpenAIProductReleases => {
                crate::parsers::OPENAI_PRODUCT_RELEASES_LISTING
            }
            PlaywrightParser::OpenAISecurity => crate::parsers::OPENAI_SECURITY_LISTING,
        }
    }
}

async fn fetch_with_playwright(playwright: &Playwright, url: &str) -> Result<String> {
    let browser = playwright
        .chromium()
        .launcher()
        .headless(true)
        .launch()
        .await
        .context("failed to launch chromium")?;
    let context = browser
        .context_builder()
        .build()
        .await
        .context("failed to create browser context")?;
    let page = context
        .new_page()
        .await
        .context("failed to open new page")?;

    page.goto_builder(url)
        .goto()
        .await
        .with_context(|| format!("navigation failed for {}", url))?;

    let html = page
        .content()
        .await
        .context("failed to read page content")?;

    // Close to release resources; ignore errors on close.
    let _ = browser.close().await;

    Ok(html)
}

#[derive(Debug, Serialize)]
struct RemotePlaywrightRequest<'a> {
    url: &'a str,
}

#[derive(Debug, Deserialize)]
struct RemotePlaywrightResponse {
    html: String,
}

async fn fetch_with_remote_playwright(
    client: &Client,
    endpoint: &str,
    url: &str,
) -> Result<String> {
    let res = client
        .post(format!("{}/crawl", endpoint))
        .json(&RemotePlaywrightRequest { url })
        .send()
        .await
        .context("remote playwright request failed")?
        .error_for_status()
        .context("remote playwright returned error status")?;

    let body: RemotePlaywrightResponse = res
        .json()
        .await
        .context("failed to parse remote playwright response")?;

    Ok(body.html)
}
