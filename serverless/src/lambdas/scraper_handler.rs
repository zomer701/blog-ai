use lambda_runtime::{Error, LambdaEvent, run, service_fn};
use parser::utils::setup_tracing;
use serde::{Deserialize, Serialize};
use tracing::{info, error};

use parser::models::Site;
use parser::services::scraper::ScraperService;

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub(crate) struct Request {
    pub sites: Vec<Site>,
}


#[derive(Serialize)]
struct Response {
    message: String,
    //errors: Vec<String>,
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

    let service = ScraperService::new().await?;
    if let Err(e) = service.execute(&request.sites).await {
        error!("Scraper execution failed: {}", e);
        return Err(e.into());
    }

    Ok(Response {
        message: "Scraping completed successfully".to_string(),
        success: true,
    })
}
