# Getting Started - Complete Guide

Complete guide to get the AI Blog system running locally and deployed to AWS. Perfect for developers new to Rust or the project.

## 📋 What This Project Does

This is an **automated blog aggregation platform** that:
1. **Scrapes** articles from AI/tech blogs (testai, HuggingFace, TechCrunch)
2. **Translates** content to Spanish and Ukrainian using AI
3. **Provides** admin dashboard for review and editing
4. **Publishes** static HTML to CloudFront with smart version control
5. **Serves** fast, cheap, multi-language blog to readers

**Architecture:** Serverless (AWS Lambda + DynamoDB + S3 + CloudFront)  
**Languages:** Rust (backend), TypeScript/React (frontend)  
**Cost:** ~$12/month  
**Performance:** 10-50ms page loads

## 🏗️ Project Structure

```
ai-blog/
├── scraper-rust/          # Lambda scraper (Rust)
│   ├── src/
│   │   ├── main.rs        # Lambda entry point
│   │   ├── scraper.rs     # Scraping logic
│   │   ├── publisher.rs   # Smart publishing (PDP/PLP)
│   │   ├── translator.rs  # AI translation
│   │   └── parsers/       # Site-specific parsers
│   └── Cargo.toml
│
├── blog-service-rust/     # Admin API (Rust + Axum)
│   ├── src/
│   │   ├── main.rs        # API server
│   │   ├── admin/         # Admin endpoints
│   │   └── storage.rs     # DynamoDB/S3 access
│   └── Cargo.toml
│
├── admin-ui/              # Admin dashboard (React)
│   ├── src/
│   │   └── components/    # React components
│   └── package.json
│
├── blog-public/           # Public website (Next.js)
│   ├── app/               # Next.js 14 app
│   └── package.json
│
└── infrastructure/        # AWS CDK (TypeScript)
    ├── lib/               # CDK stacks
    └── package.json
```

## 🔧 Prerequisites

### Required Software

1. **AWS Account** with credentials configured
2. **Node.js 18+** - [Download](https://nodejs.org/)
3. **Rust 1.75+** - [Install](https://rustup.rs/)
4. **AWS CLI** - [Install](https://aws.amazon.com/cli/)
5. **cargo-lambda** - For Lambda deployment

### Installing Rust (First Time)

```bash
# Install Rust (includes cargo, rustc, rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow prompts, then restart terminal

# Verify installation
rustc --version  # Should show: rustc 1.75.0 or higher
cargo --version  # Should show: cargo 1.75.0 or higher

# Install cargo-lambda for AWS Lambda deployment
cargo install cargo-lambda
```

### Installing Node.js

```bash
# macOS (using Homebrew)
brew install node@18

# Or download from: https://nodejs.org/

# Verify installation
node --version  # Should show: v18.x.x or higher
npm --version   # Should show: 9.x.x or higher
```

### Configuring AWS CLI

```bash
# Install AWS CLI
# macOS
brew install awscli

# Configure credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format (json)

# Verify
aws sts get-caller-identity
```

## 🚀 Quick Start (Local Development)

### Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository
git clone <your-repo-url>
cd ai-blog

# Verify Rust installation
rustc --version  # Should be 1.75+
cargo --version

# Verify Node.js installation
node --version   # Should be 18+
npm --version
```

### Step 2: Setup Scraper (Rust) (5 minutes)

```bash
cd scraper-rust

# Install dependencies (first time only)
# Cargo will download and compile all dependencies
cargo build

# This will take 5-10 minutes the first time
# Subsequent builds are much faster

# Create .env file
cat > .env << EOF
TABLE_NAME=blog-articles-local
BUCKET_NAME=blog-content-local
AWS_REGION=us-east-1
MAX_ARTICLES_PER_SITE=5
RUST_LOG=info
EOF

# Run locally (will fail without DynamoDB, but tests compilation)
cargo run

# Run tests
cargo test
```

**Understanding Rust Build:**
- First `cargo build` downloads all dependencies (crates)
- Compiles everything from source (takes time)
- Creates `target/` directory with compiled code
- Subsequent builds only recompile changed files (fast)

### Step 3: Setup Blog Service API (Rust) (5 minutes)

```bash
cd blog-service-rust

# Build the service
cargo build

# Create .env file
cat > .env << EOF
DYNAMODB_TABLE_NAME=blog-articles-local
S3_BUCKET_NAME=blog-content-local
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
RUST_LOG=info
EOF

# Run locally (will start API server on port 3001)
cargo run

# In another terminal, test the API
curl http://localhost:3001/health
```

**Understanding the API:**
- Built with Axum (Rust web framework)
- Provides REST endpoints for admin UI
- Handles authentication with Cognito JWT
- Connects to DynamoDB and S3

### Step 4: Setup Admin UI (React) (3 minutes)

```bash
cd admin-ui

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:3001
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_COGNITO_CLIENT_ID=abc123def456
EOF

# Start development server
npm start

# Opens browser at http://localhost:3000
```

**Understanding React App:**
- Built with Create React App
- TypeScript for type safety
- Connects to blog-service API
- Provides admin dashboard for managing articles

### Step 5: Setup Public Website (Next.js) (3 minutes)

```bash
cd blog-public

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_KEY=dev-key-12345
EOF

# Start development server
npm run dev

# Opens browser at http://localhost:3000
```

**Understanding Next.js App:**
- Server-side rendering (SSR)
- Static HTML generation
- Multi-language support (EN/ES/UK)
- Fast, SEO-friendly

### Step 6: Setup Local AWS Services (Optional)

For full local development, you need local DynamoDB and S3:

```bash
# Option 1: Use LocalStack (Docker)
docker run -d -p 4566:4566 localstack/localstack

# Option 2: Use DynamoDB Local
docker run -d -p 8082:8000 amazon/dynamodb-local

# Create local table
aws dynamodb create-table \
  --table-name blog-articles-local \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8082
```

## 🌐 Deployment to AWS

### Step 1: Deploy Infrastructure (5 minutes)

```bash
cd infrastructure

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy all stacks
npm run deploy

# Or deploy specific stacks
cdk deploy BlogInfrastructureStack
cdk deploy SmartPublishingStack

# Save the outputs (you'll need these):
# - API URL
# - Cognito User Pool ID
# - Cognito Client ID
# - DynamoDB Table Name
# - S3 Bucket Name
# - Staging Distribution ID
# - Production Distribution ID
```

**What gets deployed:**
- DynamoDB table for articles
- S3 buckets for content and backups
- CloudFront distributions (staging + production)
- Cognito user pool for authentication
- IAM roles and permissions

### Step 2: Deploy Scraper Lambda (3 minutes)

```bash
cd scraper-rust

# Build for Lambda (ARM64 for cost savings)
cargo lambda build --release --arm64

# Deploy to AWS
cargo lambda deploy \
  --iam-role arn:aws:iam::ACCOUNT_ID:role/blog-scraper-role

# Or use Makefile
make deploy

# Test the Lambda
aws lambda invoke \
  --function-name blog-scraper \
  --payload '{}' \
  response.json

# Check response
cat response.json
```

**Understanding Lambda Deployment:**
- Compiles Rust to ARM64 binary
- Packages as Lambda function
- Runs on schedule (EventBridge)
- Scrapes articles daily

### Step 3: Deploy Blog Service API (3 minutes)

```bash

cd blog-service-rust

# Build for Lambda
cargo lambda build --release --arm64

# Deploy
cargo lambda deploy \
  --iam-role arn:aws:iam::ACCOUNT_ID:role/blog-service-role

# Or deploy to ECS/Fargate (alternative)
# See infrastructure/README.md for ECS deployment
```

### Step 4: Deploy Admin UI (2 minutes)

```bash
cd admin-ui

# Update .env with production values
cat > .env << EOF
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_COGNITO_USER_POOL_ID=<FROM_CDK_OUTPUT>
REACT_APP_COGNITO_CLIENT_ID=<FROM_CDK_OUTPUT>
EOF

# Build for production
npm run build

# Deploy to S3 + CloudFront
aws s3 sync build/ s3://admin-ui-bucket/

# Or use CDK to deploy
cd ../infrastructure
cdk deploy AdminUIStack
```

### Step 5: Deploy Public Website (2 minutes)

```bash
cd blog-public

# Update .env.local with production values
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_API_KEY=<YOUR_PRODUCTION_KEY>
EOF

# Build for production
npm run build

# Deploy to Vercel (recommended)
vercel deploy --prod

# Or deploy to S3 + CloudFront
npm run export
aws s3 sync out/ s3://blog-public-bucket/
```

### Step 6: Create Admin User (3 minutes)

```bash
# Get User Pool ID from CDK outputs
USER_POOL_ID=<FROM_CDK_OUTPUT>

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --temporary-password TempPass123!

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --password YourSecurePassword123! \
  --permanent

# Verify user
aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com
```

## 🎉 What You Have Now

### Local Development
✅ **Scraper** running locally (Rust)
✅ **Blog Service API** running on port 3001 (Rust)
✅ **Admin UI** running on port 3000 (React)
✅ **Public Website** running on port 3000 (Next.js)
✅ **All services** can be developed independently

### Production (After Deployment)
✅ **Scraper** running daily on Lambda
✅ **Admin UI** for managing articles
✅ **Public Website** for readers
✅ **Multi-language** support (EN/ES/UK)
✅ **Smart Publishing** with staging and rollback
✅ **Static HTML** served from CloudFront
✅ **Cost**: ~$12/month

## 📚 Understanding the System

### How It Works (End-to-End)

```
1. SCRAPING (Automated Daily)
   EventBridge (9 AM) → Lambda (scraper-rust)
   ↓
   Scraper fetches articles from:
   - testai blog
   - HuggingFace blog
   - TechCrunch AI section
   ↓
   For each article:
   - Parse title, content, author, date
   - Download images to S3
   - Translate to Spanish and Ukrainian (Bedrock AI)
   - Save to DynamoDB (status: pending)

2. ADMIN REVIEW (Manual)
   Admin logs into Admin UI
   ↓
   Views pending articles
   ↓
   Edits content/translations if needed
   ↓
   Clicks "Approve" (status: approved)

3. SMART PUBLISHING (Manual)
   Admin clicks "Publish to Staging"
   ↓
   System generates HTML:
   - PDP: /articles/123-en.html (English)
   - PDP: /articles/123-es.html (Spanish)
   - PDP: /articles/123-uk.html (Ukrainian)
   ↓
   Uploads to S3 staging/ (status: staged)
   ↓
   Admin previews at staging.yourdomain.com
   ↓
   Admin clicks "Publish to Production"
   ↓
   System:
   - Backs up current production
   - Copies staging → production
   - Invalidates CloudFront cache
   - Updates status: published
   - Increments version number

4. PUBLIC ACCESS (Automatic)
   User visits yourdomain.com
   ↓
   CloudFront serves static HTML from S3
   ↓
   Fast (10-50ms), cheap, cached globally
   ↓
   User can:
   - Browse articles
   - Switch languages (EN/ES/UK)
   - Search (calls API)
   - Filter (calls API)
```

### Key Concepts

**PDP (Product Detail Page)**
- Individual article pages
- Example: `/articles/123-en.html`
- Generated per article
- Independent publishing

**PLP (Product Listing Page)**
- Homepage with article list
- Example: `/index-en.html`
- Shows all published articles
- Independent publishing

**Smart Publishing**
- Staging → Preview → Production
- Automatic backups before publish
- One-click rollback
- Version control per article

**Modular Publishing**
- PDP and PLP published separately
- Only regenerate what changed
- 10-100x faster than regenerating everything

**Static HTML**
- Pre-generated HTML files
- Served from CloudFront CDN
- Very fast (10-50ms)
- Very cheap (~$2/month)

**API for Dynamic**
- Search functionality
- Filter by category
- Analytics tracking
- Only called when needed

### Rust Basics (For Beginners)

**What is Rust?**
- Systems programming language
- Fast (like C/C++)
- Memory safe (no crashes)
- Great for serverless (small binaries)

**Key Rust Concepts:**

```rust
// 1. Ownership (Rust's superpower)
let s = String::from("hello");  // s owns the string
let s2 = s;                     // s2 now owns it, s is invalid

// 2. Borrowing (temporary access)
fn print_string(s: &String) {   // &String = borrow
    println!("{}", s);
}

// 3. Result type (error handling)
fn might_fail() -> Result<String, Error> {
    Ok("success".to_string())   // or Err(error)
}

// 4. Async/await (like JavaScript)
async fn fetch_data() -> Result<Data> {
    let response = client.get(url).await?;
    Ok(response)
}

// 5. Traits (like interfaces)
trait Parser {
    async fn parse(&self) -> Result<Article>;
}
```

**Common Cargo Commands:**

```bash
# Build project
cargo build              # Debug build (fast, large)
cargo build --release    # Release build (slow, optimized)

# Run project
cargo run                # Build + run

# Test project
cargo test               # Run all tests

# Check without building
cargo check              # Fast syntax check

# Format code
cargo fmt                # Auto-format code

# Lint code
cargo clippy             # Find issues

# Update dependencies
cargo update             # Update Cargo.lock

# Clean build artifacts
cargo clean              # Remove target/ directory
```

### Project-Specific Commands

**Scraper (scraper-rust/):**
```bash
# Run locally
cargo run

# Run with logs
RUST_LOG=debug cargo run

# Build for Lambda
cargo lambda build --release --arm64

# Deploy to Lambda
cargo lambda deploy

# Run tests
cargo test

# Run specific test
cargo test test_name
```

**Blog Service (blog-service-rust/):**
```bash
# Run API server
cargo run

# Run on different port
PORT=3002 cargo run

# Run with auto-reload (install cargo-watch first)
cargo install cargo-watch
cargo watch -x run

# Test API
curl http://localhost:3001/health
```

**Admin UI (admin-ui/):**
```bash
# Install dependencies
npm install

# Start dev server
npm start

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

**Public Website (blog-public/):**
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Export static HTML
npm run export

# Run tests
npm test
```

### Troubleshooting Common Issues

**Issue: Rust compilation fails**
```bash
# Solution 1: Update Rust
rustup update

# Solution 2: Clean and rebuild
cargo clean
cargo build

# Solution 3: Check Rust version
rustc --version  # Should be 1.75+
```

**Issue: cargo-lambda not found**
```bash
# Install cargo-lambda
cargo install cargo-lambda

# Verify installation
cargo lambda --version
```

**Issue: AWS credentials not configured**
```bash
# Configure AWS CLI
aws configure

# Verify credentials
aws sts get-caller-identity

# Check credentials file
cat ~/.aws/credentials
```

**Issue: DynamoDB table not found**
```bash
# Create local table
aws dynamodb create-table \
  --table-name blog-articles-local \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8082

# Or use production table
export TABLE_NAME=blog-articles-prod
```

**Issue: Port already in use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 npm start
```

**Issue: Node modules not found**
```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

### 1. Test the Scraper

```bash
# Manually trigger scraper
aws lambda invoke \
  --function-name blog-scraper \
  --payload '{}' \
  response.json

# Check results
cat response.json
```

### 2. Review Articles

1. Open Admin UI: http://localhost:3000
2. Login with your Cognito credentials
3. Review pending articles
4. Edit translations if needed
5. Approve and publish

### 3. View Public Website

1. Open Blog Public: http://localhost:3000
2. Browse articles
3. Switch languages (EN/ES/UK)
4. Test search functionality

### 4. Monitor Performance

```bash
# View scraper logs
aws logs tail /aws/lambda/blog-scraper --follow

# View API logs
aws logs tail /aws/lambda/blog-service --follow

# Check CloudFront cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=<DISTRIBUTION_ID> \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

## Troubleshooting

### Scraper Not Running

```bash
# Check Lambda function exists
aws lambda get-function --function-name blog-scraper

# Check EventBridge rule
aws events list-rules --name-prefix blog-scraper

# Check Lambda permissions
aws lambda get-policy --function-name blog-scraper
```

### Admin UI Can't Connect

1. Check API URL in `.env`
2. Verify Cognito credentials
3. Check CORS settings in API
4. Check browser console for errors

### Public Website Shows No Articles

1. Check API URL in `.env.local`
2. Verify articles are published (not just approved)
3. Check API is running
4. Check browser console for errors

### Caching Not Working

```bash
# Check CloudFront distribution
aws cloudfront list-distributions

# Check cache policy
aws cloudfront get-cache-policy --id <POLICY_ID>

# Test cache headers
curl -I https://your-cloudfront-url.com/api/articles
# Look for: X-Cache: Hit from cloudfront
```

## Common Commands

```bash
# Deploy everything
cd infrastructure && npm run deploy
cd ../scraper-rust && make deploy
cd ../admin-ui && npm run build
cd ../blog-public && npm run build

# Run locally
cd blog-service-rust && cargo run  # Terminal 1
cd admin-ui && npm start            # Terminal 2
cd blog-public && npm run dev       # Terminal 3

# View logs
aws logs tail /aws/lambda/blog-scraper --follow
aws logs tail /aws/lambda/blog-service --follow

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

## Documentation

### Core Documentation
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Local Development**: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- **Apps Overview**: [APPS_OVERVIEW.md](APPS_OVERVIEW.md)

### Performance & Optimization
- **Caching**: [CACHING_STRATEGY.md](CACHING_STRATEGY.md)
- **Performance**: [PERFORMANCE.md](PERFORMANCE.md)

### Smart Publishing System
- **Overview**: [SMART_PUBLISHING.md](SMART_PUBLISHING.md)
- **Setup Guide**: [SMART_PUBLISHING_SETUP.md](SMART_PUBLISHING_SETUP.md)
- **Quick Start**: [SMART_PUBLISHING_QUICKSTART.md](SMART_PUBLISHING_QUICKSTART.md)
- **Implementation**: [SMART_PUBLISHING_IMPLEMENTATION.md](SMART_PUBLISHING_IMPLEMENTATION.md)

## Support

- **Issues**: Create GitHub issue
- **Questions**: Check documentation
- **Bugs**: Include logs and steps to reproduce

## Success Checklist

### Basic Setup
- [ ] Infrastructure deployed
- [ ] Scraper Lambda deployed and tested
- [ ] Admin UI running locally
- [ ] Blog Public running locally
- [ ] Cognito admin user created

### First Article Workflow
- [ ] First article scraped
- [ ] Article reviewed in Admin UI
- [ ] Article approved
- [ ] Article published to staging (preview)
- [ ] Staging URL tested
- [ ] Article published to production (live)
- [ ] Article visible on public website
- [ ] Language switching works (EN/ES/UK)

### Performance & Monitoring
- [ ] Caching enabled and working
- [ ] CloudFront cache hit rate >80%
- [ ] Monitoring dashboard set up
- [ ] Backup created automatically
- [ ] Rollback tested successfully

---

**Congratulations!** 🎉 Your AI Blog system is now running!

Next: Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system design.
