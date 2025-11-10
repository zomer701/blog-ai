#!/bin/bash
set -e

# Complete Deployment Script
# Builds Lambda functions and deploys infrastructure with CDK

echo "🚀 AI Blog Scraper - Complete Deployment"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STACK_NAME="AiBlogInfrastructureStack"
REGION="${AWS_REGION:-us-east-1}"

# Check prerequisites
echo ""
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install it first.${NC}"
    exit 1
fi

# Check Rust
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Rust not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Get AWS account info
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo ""
echo "Deploying to:"
echo "  Account: $ACCOUNT_ID"
echo "  Region: $REGION"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Step 1: Build Lambda functions
echo ""
echo -e "${YELLOW}📦 Step 1/4: Building Lambda functions...${NC}"

# Check if cargo-lambda is installed
if ! command -v cargo-lambda &> /dev/null; then
    echo -e "${YELLOW}⚠️  cargo-lambda not found. Installing...${NC}"
    pip3 install cargo-lambda
fi

./scripts/build-lambda.sh

# Verify builds exist
if [ ! -d "scraper-rust/target/lambda/scraper" ]; then
    echo -e "${RED}❌ Scraper Lambda build failed${NC}"
    exit 1
fi

if [ ! -d "blog-service-rust/target/lambda/admin-api" ]; then
    echo -e "${RED}❌ Admin API Lambda build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Lambda builds verified${NC}"

# Step 2: Build Admin UI
echo ""
echo -e "${YELLOW}🎨 Step 2/4: Building Admin UI...${NC}"
cd admin-ui
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
npm run build
cd ..
echo -e "${GREEN}✅ Admin UI built${NC}"

# Step 3: Install CDK dependencies
echo ""
echo -e "${YELLOW}📚 Step 3/4: Installing CDK dependencies...${NC}"
cd infrastructure
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..
echo -e "${GREEN}✅ CDK dependencies installed${NC}"

# Step 4: Deploy with CDK
echo ""
echo -e "${YELLOW}☁️  Step 4/4: Deploying infrastructure with CDK...${NC}"
cd infrastructure
npm run deploy

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo ""
    echo "Getting stack outputs..."
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs' \
        --output table
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Create admin user: ./scripts/create-admin-user.sh <email>"
echo "  2. Test scraper: aws lambda invoke --function-name ai-blog-scraper output.json"
echo "  3. Access Admin UI using the CloudFront URL from outputs above"
