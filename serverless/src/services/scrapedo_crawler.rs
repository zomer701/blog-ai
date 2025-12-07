use anyhow::{Context, Result};
use reqwest::Client;
use tracing::{debug, info, warn};

use crate::models::{ListingItem, ScrapeResults, Site};
use crate::parsers::{parse_openai_article_html, parse_openai_news_list, OPENAI_BASE};
use crate::storage::Storage;

pub struct ScrapedoCrawlerService {
    storage: Storage,
    crawler: ScrapedoCrawler,
}

impl ScrapedoCrawlerService {
    pub async fn new() -> Result<Self> {
        let storage = Storage::from_env().await?;
        let crawler = ScrapedoCrawler::from_env().await?;
        Ok(Self { storage, crawler })
    }

    pub async fn execute(&self, sites: &[Site]) -> Result<ScrapeResults> {
        let mut results = ScrapeResults::default();

        for site in sites {
            debug!(
                "Preparing Scrape.do scrape for {} (top_articles: {:?}, provided: {})",
                site.name,
                site.top_articles,
                site.articles.len()
            );

            let Some(parser) = ScrapedoParser::from_site_name(&site.name) else {
                warn!("Scrape.do parser not implemented for {}", site.name);
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
        parser: &ScrapedoParser,
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
                "TAG:SCRAPEDO_LISTING {}: {} -> {}",
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
        parser: &ScrapedoParser,
    ) -> Result<usize> {
        let mut new_articles = 0;

        for url in &site.articles {
            info!("{}: Scrape.do scraping provided url {}", parser.name(), url);
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

    async fn fetch_listing(&self, parser: &ScrapedoParser) -> Result<Vec<ListingItem>> {
        let listing_html = self
            .crawler
            .fetch_html(parser.listing_url())
            .await
            .context("failed to fetch listing via scrape.do")?;

        let items = match parser {
            ScrapedoParser::OpenAIProductReleases => {
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
            ScrapedoParser::OpenAISecurity => parse_openai_news_list(&listing_html, OPENAI_BASE)
                .into_iter()
                .map(|a| ListingItem {
                    url: a.url,
                    title: a.title,
                    category: a.category,
                    date_text: a.date_text,
                })
                .collect(),
            ScrapedoParser::OpenAIResearch
            | ScrapedoParser::OpenAICompanyAnnouncements
            | ScrapedoParser::OpenAIEngineering
            | ScrapedoParser::OpenAISafetyAlignment => {
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
        };

        Ok(items)
    }

    async fn parse_article(
        &self,
        _parser: &ScrapedoParser,
        url: &str,
    ) -> Result<crate::models::ScrapedArticle> {
        let html = self
            .crawler
            .fetch_html(url)
            .await
            .with_context(|| format!("failed to fetch article via scrape.do: {}", url))?;
        parse_openai_article_html(&html)
    }
}

struct ScrapedoCrawler {
    http_client: Client,
    token: String,
    endpoint: String,
}

impl ScrapedoCrawler {
    async fn from_env() -> Result<Self> {
        let token = std::env::var("SCRAPEDO_TOKEN")
            .context("SCRAPEDO_TOKEN must be set to call scrape.do")?;
        let endpoint = std::env::var("SCRAPEDO_ENDPOINT")
            .unwrap_or_else(|_| "http://api.scrape.do/".to_string());
        let endpoint = endpoint.trim_end_matches('/').to_string();

        let http_client = Client::builder()
            .build()
            .context("failed to build reqwest client for scrape.do crawler")?;

        Ok(Self {
            http_client,
            token,
            endpoint,
        })
    }

    async fn fetch_html(&self, target_url: &str) -> Result<String> {
        let res = self
            .http_client
            .get(format!("{}/", self.endpoint))
            .query(&[("url", target_url), ("token", &self.token)])
            .send()
            .await
            .context("scrape.do request failed")?
            .error_for_status()
            .context("scrape.do returned error status")?;

        let body = res.text().await.context("failed to read scrape.do body")?;
        Ok(body)
    }
}

#[derive(Clone)]
enum ScrapedoParser {
    OpenAIProductReleases,
    OpenAISecurity,
    OpenAIResearch,
    OpenAICompanyAnnouncements,
    OpenAIEngineering,
    OpenAISafetyAlignment,
}

impl ScrapedoParser {
    fn from_site_name(name: &str) -> Option<Self> {
        match name {
            "openai-product-releases" => Some(Self::OpenAIProductReleases),
            "openai-security" => Some(Self::OpenAISecurity),
            "openai-research" => Some(Self::OpenAIResearch),
            "openai-company-announcements" => Some(Self::OpenAICompanyAnnouncements),
            "openai-engineering" => Some(Self::OpenAIEngineering),
            "openai-safety-alignment" => Some(Self::OpenAISafetyAlignment),
            _ => None,
        }
    }

    fn name(&self) -> &'static str {
        match self {
            ScrapedoParser::OpenAIProductReleases => "openai-product-releases",
            ScrapedoParser::OpenAISecurity => "openai-security",
            ScrapedoParser::OpenAIResearch => "openai-research",
            ScrapedoParser::OpenAICompanyAnnouncements => "openai-company-announcements",
            ScrapedoParser::OpenAIEngineering => "openai-engineering",
            ScrapedoParser::OpenAISafetyAlignment => "openai-safety-alignment",
        }
    }

    fn listing_url(&self) -> &'static str {
        match self {
            ScrapedoParser::OpenAIProductReleases => {
                crate::parsers::OPENAI_PRODUCT_RELEASES_LISTING
            }
            ScrapedoParser::OpenAISecurity => crate::parsers::OPENAI_SECURITY_LISTING,
            ScrapedoParser::OpenAIResearch => crate::parsers::OPENAI_RESEARCH_LISTING,
            ScrapedoParser::OpenAICompanyAnnouncements => {
                crate::parsers::OPENAI_COMPANY_ANNOUNCEMENTS_LISTING
            }
            ScrapedoParser::OpenAIEngineering => crate::parsers::OPENAI_ENGINEERING_LISTING,
            ScrapedoParser::OpenAISafetyAlignment => {
                crate::parsers::OPENAI_SAFETY_ALIGNMENT_LISTING
            }
        }
    }
}
