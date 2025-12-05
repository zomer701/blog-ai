use anyhow::Context;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use parser::utils::setup_tracing;
use serde::{Deserialize, Serialize};
use tracing::{error, info};

use parser::models::Site;
use parser::services::playwright_crawler::PlaywrightCrawlerService;
use parser::services::scrapedo_crawler::ScrapedoCrawlerService;
use parser::services::scraper::ScraperService;

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub(crate) struct Request {
    pub service: Option<String>,
    pub sites: Vec<Site>,
}

#[derive(Serialize)]
struct Response {
    message: String,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    errors: Vec<String>,
    success: bool,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    setup_tracing();

    run(service_fn(function_handler)).await
}

async fn function_handler(event: LambdaEvent<Request>) -> Result<Response, Error> {
    let (request, _context) = event.into_parts();
    info!("Starting blog scraper {:?}", request);

    let result: anyhow::Result<Response> = async {
        let service_name = request
            .service
            .as_deref()
            .unwrap_or("scraper")
            .to_lowercase();

        match service_name.as_str() {
            "playwright" | "playwright-crawler" => {
                let service = PlaywrightCrawlerService::new()
                    .await
                    .context("init playwright crawler service")?;
                service
                    .execute(&request.sites)
                    .await
                    .context("playwright execution")?;
            }
            "scrapedo" | "scrape.do" | "scrape-do" => {
                let service = ScrapedoCrawlerService::new()
                    .await
                    .context("init scrape.do crawler service")?;
                service
                    .execute(&request.sites)
                    .await
                    .context("scrape.do execution")?;
            }
            "jordangonzalez" | _ => {
                let service = ScraperService::new()
                    .await
                    .context("init scraper service")?;
                service
                    .execute(&request.sites)
                    .await
                    .context("scraper execution")?;
            }
        };

        Ok(Response {
            message: "Scraping completed successfully".to_string(),
            success: true,
            errors: vec![],
        })
    }
    .await;

    match result {
        Ok(resp) => Ok(resp),
        Err(e) => {
            // Emit a clear failure line for log-based alerting, but keep the response minimal.
            error!("Scraping failed (response will remain minimal): {:?}", e);
            Ok(Response {
                message: "Scraping failed".to_string(),
                success: false,
                errors: vec![],
            })
        }
    }
}
