# Infrastructure

AWS CDK infrastructure for the AI Blog system.

## Overview

This CDK app deploys the complete infrastructure for:
- **Scraper Service** - Lambda function that scrapes blogs
- **Admin API** - REST API for managing articles
- **Admin UI** - React admin dashboard
- **Public Website** - Static blog website
- **Storage** - DynamoDB tables and S3 buckets
- **Authentication** - Cognito user pool

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AWS Infrastructure                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │ EventBridge  │─────▶│   Lambda     │                     │
│  │  Scheduler   │      │  (Scraper)   │                     │
│  └──────────────┘      └──────┬───────┘                     │
│                               │                              │
│                               ▼                              │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │  CloudFront  │      │  DynamoDB    │                     │
│  │  (Admin UI)  │      │  (Articles)  │                     │
│  └──────┬───────┘      └──────────────┘                     │
│         │                                                    │
│         ▼              ┌──────────────┐                     │
│  ┌──────────────┐      │      S3      │                     │
│  │ API Gateway  │      │   (Content)  │                     │
│  └──────┬───────┘      └──────────────┘                     │
│         │                                                    │
│         ▼              ┌──────────────┐                     │
│  ┌──────────────┐      │   Cognito    │                     │
│  │   Lambda     │      │  User Pool   │                     │
│  │ (Admin API)  │      └──────────────┘                     │
│  └──────────────┘                                           │
│                                                               │
│  ┌──────────────┐                                           │
│  │  CloudFront  │                                           │
│  │   (Public)   │                                           │
│  └──────────────┘                                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Node.js** 18+ and npm
2. **AWS CLI** configured with credentials
3. **AWS CDK** installed globally:
   ```bash
   npm install -g aws-cdk
   ```
4. **Rust** and **cargo-lambda** (for building Lambda functions)

## Configuration

### Environment Files

All configuration is centralized in `config/environments.ts`:

- **Development**: Lower costs, shorter retention, more frequent scraping
- **Production**: Full features, longer retention, optimized schedule

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
ENVIRONMENT=dev  # or prod
AWS_REGION=us-east-1
CDK_DEFAULT_ACCOUNT=123456789012
```

## Deployment

### First Time Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Bootstrap CDK** (one-time per account/region)
   ```bash
   cdk bootstrap
   ```

3. **Build Lambda functions**
   ```bash
   # Build scraper
   cd ../scraper-rust
   cargo lambda build --release --arm64
   
   # Build admin API
   cd ../blog-service-rust
   cargo lambda build --release --arm64
   ```

4. **Deploy infrastructure**
   ```bash
   npm run deploy
   ```

### Subsequent Deployments

```bash
# Deploy all stacks
npm run deploy

# Deploy specific stack
cdk deploy AiBlogInfrastructureStack

# Preview changes
npm run diff

# Destroy all resources
npm run destroy
```

## Stack Resources

### DynamoDB Tables

- **ArticlesTable** - Stores scraped articles
  - Partition Key: `id` (String)
  - GSI: `status-created_at-index`
  - Billing: On-Demand
  
- **AnalyticsTable** - Stores view analytics
  - Partition Key: `article_id` (String)
  - Sort Key: `timestamp` (String)
  - TTL: 90 days

### S3 Buckets

- **Content Bucket** - Images and raw HTML
- **Public Website Bucket** - Generated static site
- **Admin UI Bucket** - React admin dashboard

### Lambda Functions

- **Scraper Function**
  - Runtime: Rust (provided.al2)
  - Memory: 512 MB
  - Timeout: 15 minutes
  - Trigger: EventBridge schedule
  
- **Admin API Function**
  - Runtime: Rust (provided.al2)
  - Memory: 256 MB
  - Timeout: 30 seconds
  - Trigger: API Gateway

### CloudFront Distributions

- **Admin UI Distribution** - Serves admin dashboard
- **Public Website Distribution** - Serves public blog

### Cognito

- **User Pool** - Admin authentication
- **User Pool Client** - Admin UI client

## Outputs

After deployment, CDK outputs important values:

```
ArticlesTableName = ArticlesTable
AnalyticsTableName = AnalyticsTable
ContentBucketName = ai-blog-content-123456789012
AdminUiUrl = https://d1234567890.cloudfront.net
ApiUrl = https://abcdef1234.execute-api.us-east-1.amazonaws.com/prod/
UserPoolId = us-east-1_ABC123DEF
UserPoolClientId = 1a2b3c4d5e6f7g8h9i0j
ScraperFunctionName = ai-blog-scraper
```

Save these values for configuring the admin UI and local development.

## Cost Estimation

### Development Environment
- DynamoDB: ~$0-1/month (on-demand)
- S3: ~$0-1/month (minimal storage)
- Lambda: ~$0-2/month (scraper runs)
- CloudFront: ~$0-1/month (low traffic)
- **Total: ~$2-5/month**

### Production Environment
- DynamoDB: ~$5-10/month
- S3: ~$1-3/month
- Lambda: ~$2-5/month
- CloudFront: ~$5-10/month
- **Total: ~$15-30/month**

## Monitoring

### CloudWatch Logs

- `/aws/lambda/ai-blog-scraper` - Scraper logs
- `/aws/lambda/ai-blog-admin-api` - Admin API logs

### CloudWatch Metrics

- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- S3 bucket size and requests
- CloudFront requests and data transfer

## Troubleshooting

### Deployment Fails

```bash
# Check CDK version
cdk --version

# Update CDK
npm install -g aws-cdk@latest

# Clear CDK cache
rm -rf cdk.out
```

### Lambda Build Issues

```bash
# Ensure Lambda functions are built
cd ../scraper-rust
cargo lambda build --release --arm64

cd ../blog-service-rust
cargo lambda build --release --arm64
```

### Permission Errors

Ensure your AWS credentials have sufficient permissions:
- CloudFormation
- Lambda
- DynamoDB
- S3
- CloudFront
- Cognito
- IAM

## Development Workflow

1. Make infrastructure changes in `lib/`
2. Update configuration in `config/environments.ts`
3. Preview changes: `npm run diff`
4. Deploy: `npm run deploy`
5. Test changes
6. Commit to git

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Deploy Infrastructure
  run: |
    cd infrastructure
    npm install
    npm run deploy -- --require-approval never
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    ENVIRONMENT: prod
```

## Cleanup

To delete all resources:

```bash
npm run destroy
```

**Warning**: This will delete all data in DynamoDB and S3 (unless retention policies prevent it).

## Support

- AWS CDK Docs: https://docs.aws.amazon.com/cdk/
- CDK Workshop: https://cdkworkshop.com/
- AWS CDK Examples: https://github.com/aws-samples/aws-cdk-examples
