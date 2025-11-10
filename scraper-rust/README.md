# Blog Scraper Service (Rust)

A high-performance, modular blog scraping service built in Rust that automatically collects, translates, and manages AI/tech blog content from multiple sources.

## Overview

This service scrapes articles from popular AI and technology blogs, stores them in DynamoDB, handles image assets in S3, and provides automatic translation capabilities. It's designed to run as a scheduled Lambda function or containerized service.

## Architecture

### Infrastructure Components

```
┌─────────────────┐
│  EventBridge    │  ← Scheduled trigger (daily at 9 AM)
│   (Scheduler)   │     cron(0 9 * * ? *)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Lambda         │  ← Rust scraper (512 MB, 15 min timeout)
│  (Scraper)      │     ARM64 for cost savings
└────────┬────────┘
         │
         ├──────────────────┐
         │                  │
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│   DynamoDB      │  │      S3         │
│ (ArticlesTable) │  │  (Images/HTML)  │
│  On-Demand      │  │  Standard       │
└─────────────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Bedrock API    │  ← Translation (future)
│  (Claude/Titan) │
└─────────────────┘

Cost: ~$1-2/month for daily scraping
```

### Data Flow

1. **Scraping Phase**
   - Fetch listing pages from configured sources
   - Extract article URLs and metadata
   - Check DynamoDB for existing articles (deduplication)
   - Parse full article content from individual pages

2. **Storage Phase**
   - Download and upload images to S3
   - Store article metadata and content in DynamoDB
   - Set initial status as `pending`

3. **Translation Phase** (Future)
   - Translate content to Spanish and Ukrainian
   - Store translations with edit tracking
   - Mark for admin review

## Project Structure

```
scraper-rust/
├── src/
│   ├── main.rs              # Entry point & orchestration
│   ├── config.rs            # Environment configuration
│   ├── models.rs            # Data structures & types
│   ├── scraper.rs           # Core scraping logic
│   ├── storage.rs           # DynamoDB & S3 operations
│   ├── translator.rs        # Bedrock translation client
│   ├── html_generator.rs    # Static HTML generation
│   └── parsers/             # Site-specific parsers
│       ├── mod.rs           # Parser trait & utilities
│       ├── testai.rs        # testai blog parser
│       ├── huggingface.rs   # HuggingFace blog parser
│       └── techcrunch.rs    # TechCrunch AI parser
├── Cargo.toml               # Dependencies
└── README.md                # This file
```

## Core Components

### 1. Parser System

Each site has a dedicated parser implementing the `Parser` trait:

```rust
#[async_trait]
pub trait Parser: Send + Sync {
    fn name(&self) -> &str;
    async fn parse_listing(&self) -> Result<Vec<ListingItem>>;
    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle>;
}
```

**Two-step scraping approach:**
- **Step 1**: Parse listing page to get article URLs
- **Step 2**: Parse individual article pages for full content

### 2. Storage Layer

**DynamoDB Schema:**
```
ArticlesTable
├── id (String, PK)           # SHA-256 hash of URL
├── source (String)           # "testai", "huggingface", etc.
├── source_url (String)       # Original article URL
├── title (String)
├── author (String)
├── published_date (String)
├── scraped_at (Number)       # Unix timestamp
├── status (String)           # "pending", "approved", "published"
├── content (Map)
│   ├── original_html
│   ├── text
│   └── images (List)
├── translations (Map)
│   ├── es (Map)
│   │   ├── title
│   │   ├── content
│   │   ├── edited (Boolean)
│   │   └── edited_at (Number)
│   └── uk (Map)
│       └── ...
└── metadata (Map)
    ├── word_count
    ├── reading_time
    └── tags (List)
```

**S3 Structure:**
```
blog-content-bucket/
├── images/
│   └── {article-id}/
│       ├── image1.jpg
│       └── image2.png
└── html/
    └── {article-id}.html
```

### 3. Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TABLE_NAME` | DynamoDB table name | `ArticlesTable` |
| `BUCKET_NAME` | S3 bucket for assets | `blog-content-bucket` |
| `AUTO_PUBLISH` | Auto-approve articles | `false` |
| `MAX_ARTICLES_PER_SITE` | Limit per scrape run | `10` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `RUST_LOG` | Logging level | `info` |

## Getting Started

### Prerequisites

- Rust 1.70+ (`rustup install stable`)
- AWS credentials configured
- DynamoDB table created
- S3 bucket created

### Local Development

```bash
# Install dependencies
cargo build

# Run with logging
RUST_LOG=info cargo run

# Run tests
cargo test

# Run specific parser test
cargo test testai

# Check code
cargo check

# Format code
cargo fmt

# Lint
cargo clippy
```

### Environment Setup

```bash
# .env file
TABLE_NAME=ArticlesTable
BUCKET_NAME=blog-content-bucket
AUTO_PUBLISH=false
MAX_ARTICLES_PER_SITE=10
AWS_REGION=us-east-1
```

## Adding a New Site Parser

### Step 1: Create Parser File

Create `src/parsers/newsite.rs`:

```rust
use anyhow::{Result, Context};
use async_trait::async_trait;
use scraper::{Html, Selector};
use reqwest::Client;

use crate::models::{ListingItem, ScrapedArticle};
use super::{Parser, extract_text, make_absolute_url};

pub struct NewSiteParser {
    client: Client,
    base_url: String,
}

impl NewSiteParser {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Mozilla/5.0 (compatible; BlogScraper/1.0)")
                .build()
                .unwrap(),
            base_url: "https://example.com".to_string(),
        }
    }
}

#[async_trait]
impl Parser for NewSiteParser {
    fn name(&self) -> &str {
        "newsite"
    }
    
    async fn parse_listing(&self) -> Result<Vec<ListingItem>> {
        // Implement listing page parsing
        todo!()
    }
    
    async fn parse_article(&self, url: &str) -> Result<ScrapedArticle> {
        // Implement article page parsing
        todo!()
    }
}
```

### Step 2: Register Parser

Add to `src/parsers/mod.rs`:
```rust
pub mod newsite;
```

Add to `src/scraper.rs`:
```rust
let parsers: Vec<Box<dyn Parser>> = vec![
    Box::new(testai::testaiParser::new()),
    Box::new(huggingface::HuggingFaceParser::new()),
    Box::new(techcrunch::TechCrunchParser::new()),
    Box::new(newsite::NewSiteParser::new()),  // Add here
];
```

### Step 3: Test Parser

```bash
cargo test newsite
```

## Deployment

### AWS Lambda (Recommended - Simplest)

Lambda is the simplest deployment option for this scraper:
- **No servers to manage** - fully serverless
- **Pay per execution** - only pay when scraping runs
- **Built-in scheduling** - EventBridge triggers
- **Auto-scaling** - handles concurrent executions
- **15-minute timeout** - enough for scraping 10-20 articles

#### Option 1: Using cargo-lambda (Easiest)

```bash
# Install cargo-lambda
cargo install cargo-lambda

# Build for Lambda (ARM64 is cheaper)
cargo lambda build --release --arm64

# Deploy directly
cargo lambda deploy blog-scraper \
  --env-var TABLE_NAME=ArticlesTable \
  --env-var BUCKET_NAME=blog-content-bucket \
  --env-var AWS_REGION=us-east-1 \
  --timeout 900 \
  --memory 512

# Create EventBridge schedule (daily at 9 AM UTC)
aws events put-rule \
  --name blog-scraper-daily \
  --schedule-expression "cron(0 9 * * ? *)"

aws events put-targets \
  --rule blog-scraper-daily \
  --targets "Id"="1","Arn"="arn:aws:lambda:REGION:ACCOUNT:function:blog-scraper"

# Grant EventBridge permission to invoke Lambda
aws lambda add-permission \
  --function-name blog-scraper \
  --statement-id EventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT:rule/blog-scraper-daily
```

#### Option 2: Using AWS SAM

Create `template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  BlogScraperFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: blog-scraper
      CodeUri: .
      Handler: bootstrap
      Runtime: provided.al2023
      Architectures:
        - arm64
      MemorySize: 512
      Timeout: 900
      Environment:
        Variables:
          TABLE_NAME: ArticlesTable
          BUCKET_NAME: blog-content-bucket
          RUST_LOG: info
      Policies:
        - DynamoDBCrudPolicy:
            TableName: ArticlesTable
        - S3CrudPolicy:
            BucketName: blog-content-bucket
      Events:
        DailySchedule:
          Type: Schedule
          Properties:
            Schedule: cron(0 9 * * ? *)
            Description: Run scraper daily at 9 AM UTC
```

```bash
# Build and deploy
cargo lambda build --release --arm64
sam deploy --guided
```

#### Option 3: Manual Lambda Package

```bash
# Build
cargo build --release --target aarch64-unknown-linux-gnu

# Package
cd target/aarch64-unknown-linux-gnu/release
cp scraper bootstrap
zip lambda.zip bootstrap

# Upload to Lambda
aws lambda create-function \
  --function-name blog-scraper \
  --runtime provided.al2023 \
  --architectures arm64 \
  --handler bootstrap \
  --zip-file fileb://lambda.zip \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --timeout 900 \
  --memory-size 512 \
  --environment Variables="{TABLE_NAME=ArticlesTable,BUCKET_NAME=blog-content-bucket}"
```

### Lambda Configuration Tips

**Memory**: Start with 512 MB, increase if needed
- More memory = faster CPU
- Typical usage: 256-512 MB

**Timeout**: 900 seconds (15 minutes max)
- Scraping 10 articles: ~2-3 minutes
- Scraping 30 articles: ~5-8 minutes

**Concurrency**: Reserved concurrency = 1
- Prevents multiple scrapers running simultaneously
- Avoids duplicate articles

**Environment Variables**:
```bash
TABLE_NAME=ArticlesTable
BUCKET_NAME=blog-content-bucket
AWS_REGION=us-east-1
MAX_ARTICLES_PER_SITE=10
RUST_LOG=info
```

### Alternative: Docker/ECS (For Complex Needs)

Only use ECS if you need:
- Longer than 15-minute execution
- More than 10 GB memory
- Persistent connections
- Custom networking

```dockerfile
FROM rust:1.70 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/scraper /usr/local/bin/
CMD ["scraper"]
```

```bash
# Build and push
docker build -t blog-scraper .
aws ecr get-login-password | docker login --username AWS --password-stdin {account}.dkr.ecr.{region}.amazonaws.com
docker tag blog-scraper:latest {account}.dkr.ecr.{region}.amazonaws.com/blog-scraper:latest
docker push {account}.dkr.ecr.{region}.amazonaws.com/blog-scraper:latest

# Create ECS task definition and service
# (Use AWS Console or CDK for easier setup)
```

### Cost Comparison

**Lambda** (Recommended):
- Free tier: 1M requests + 400,000 GB-seconds/month
- Daily scraping: ~$0.50-2/month
- No idle costs

**ECS Fargate**:
- 0.25 vCPU + 0.5 GB: ~$10-15/month
- Runs 24/7 even when idle
- Better for continuous workloads

**Recommendation**: Use Lambda unless you have specific ECS requirements.

## Monitoring & Logging

### CloudWatch Logs

Logs are structured with tracing:

```rust
info!("Scraping {}...", parser_name);
warn!("Failed to scrape article {}: {}", url, error);
error!("Scraping failed: {}", error);
```

### Metrics to Track

- Articles scraped per run
- Success/failure rate per source
- Scraping duration
- DynamoDB write latency
- S3 upload size/duration

### Example CloudWatch Insights Query

```
fields @timestamp, @message
| filter @message like /Found \d+ new articles/
| stats count() by source
```

## Troubleshooting

### Common Issues

**Parser fails to find content:**
- Inspect HTML structure with browser DevTools
- Update CSS selectors in parser
- Check for JavaScript-rendered content (may need headless browser)

**DynamoDB throttling:**
- Increase table capacity
- Add exponential backoff retry logic
- Batch write operations

**Lambda timeout:**
- Increase timeout setting (max 15 minutes)
- Process fewer articles per run
- Consider Step Functions for long-running jobs

## Performance

- **Scraping speed**: ~2-5 seconds per article
- **Memory usage**: ~50-100 MB
- **Lambda cold start**: ~1-2 seconds
- **Concurrent parsers**: 3 sites in parallel

## Security

- IAM role with least privilege (DynamoDB, S3, Bedrock access only)
- No hardcoded credentials
- User-Agent header to identify scraper
- Respect robots.txt (implement if needed)
- Rate limiting per site

## Future Enhancements

- [ ] Implement Bedrock translation integration
- [ ] Add robots.txt compliance
- [ ] Implement rate limiting per site
- [ ] Add retry logic with exponential backoff
- [ ] Support for JavaScript-rendered content (headless browser)
- [ ] Webhook notifications for new articles
- [ ] Admin dashboard integration
- [ ] Content deduplication across sources
- [ ] RSS feed support

## Contributing

1. Add new parser following the guide above
2. Write tests for your parser
3. Update this README
4. Submit PR with example output

## License

MIT
