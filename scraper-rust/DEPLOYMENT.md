# Deployment Guide

Quick guide to deploy the blog scraper to AWS Lambda.

## Prerequisites

1. **Install Rust**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Install cargo-lambda**
   ```bash
   cargo install cargo-lambda
   ```

3. **Install AWS SAM CLI**
   ```bash
   # macOS
   brew install aws-sam-cli
   
   # Linux
   pip install aws-sam-cli
   
   # Or download from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
   ```

4. **Configure AWS credentials**
   ```bash
   aws configure
   ```

## Quick Deploy (3 Steps)

### 1. Build
```bash
make build
# or: cargo lambda build --release --arm64
```

### 2. Deploy
```bash
make deploy
# or: sam deploy --guided
```

Follow the prompts:
- Stack Name: `blog-scraper-stack`
- AWS Region: `us-east-1` (or your preferred region)
- Parameter TableName: `ArticlesTable`
- Parameter BucketName: `blog-content-bucket`
- Confirm changes: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to config: `Y`

### 3. Test
```bash
make invoke
# or: aws lambda invoke --function-name blog-scraper --payload '{}' response.json
```

## Subsequent Deploys

After the first deployment, use:
```bash
make deploy-fast
```

This uses saved configuration from `samconfig.toml`.

## Local Testing

### Test Lambda locally
```bash
make invoke-local
```

### Run as regular binary (not Lambda)
```bash
cargo run
```

## Monitoring

### Watch logs in real-time
```bash
make logs
# or: sam logs -n BlogScraperFunction --tail
```

### View logs in AWS Console
1. Go to CloudWatch → Log groups
2. Find `/aws/lambda/blog-scraper`
3. View log streams

## Configuration

### Update environment variables
Edit `template.yaml` or use AWS Console:
```yaml
Environment:
  Variables:
    TABLE_NAME: ArticlesTable
    BUCKET_NAME: blog-content-bucket
    MAX_ARTICLES_PER_SITE: 10
    RUST_LOG: info
```

### Change schedule
Edit `template.yaml`:
```yaml
Schedule: cron(0 9 * * ? *)  # Daily at 9 AM UTC
```

Common schedules:
- Every hour: `rate(1 hour)`
- Every 6 hours: `rate(6 hours)`
- Daily at 9 AM: `cron(0 9 * * ? *)`
- Weekdays at 9 AM: `cron(0 9 ? * MON-FRI *)`

## Troubleshooting

### Build fails
```bash
# Clean and rebuild
make clean
make build
```

### Lambda timeout
Increase timeout in `template.yaml`:
```yaml
Timeout: 900  # Max 900 seconds (15 minutes)
```

### Out of memory
Increase memory in `template.yaml`:
```yaml
MemorySize: 1024  # Increase from 512 MB
```

### Permission errors
Check IAM policies in `template.yaml`:
```yaml
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref TableName
  - S3CrudPolicy:
      BucketName: !Ref BucketName
```

## Cost Optimization

### Use ARM64 (already configured)
- 20% cheaper than x86_64
- Same performance

### Adjust memory
- Start with 512 MB
- Monitor CloudWatch metrics
- Increase only if needed

### Set reserved concurrency
Prevent multiple simultaneous executions:
```yaml
ReservedConcurrentExecutions: 1
```

## Cleanup

### Delete stack
```bash
sam delete
```

### Manual cleanup
```bash
aws cloudformation delete-stack --stack-name blog-scraper-stack
```

## Advanced

### Deploy to multiple regions
```bash
sam deploy --region us-west-2 --stack-name blog-scraper-west
```

### Use different environments
```bash
sam deploy --parameter-overrides Environment=staging
```

### CI/CD Integration
Add to GitHub Actions:
```yaml
- name: Deploy to Lambda
  run: |
    cargo lambda build --release --arm64
    sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
```

## Support

- AWS SAM docs: https://docs.aws.amazon.com/serverless-application-model/
- cargo-lambda docs: https://www.cargo-lambda.info/
- Lambda docs: https://docs.aws.amazon.com/lambda/
