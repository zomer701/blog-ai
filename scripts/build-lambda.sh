#!/bin/bash
set -e

# Build Lambda Functions for Deployment
# This script builds both Rust Lambda functions for AWS deployment

echo "🚀 Building Lambda Functions for AWS Deployment"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if cargo-lambda is installed
if ! command -v cargo-lambda &> /dev/null; then
    echo -e "${RED}❌ cargo-lambda not found${NC}"
    echo "Installing cargo-lambda..."
    pip3 install cargo-lambda
fi

# Function to build a Rust Lambda
build_lambda() {
    local project_dir=$1
    local function_name=$2
    
    echo ""
    echo -e "${YELLOW}📦 Building ${function_name}...${NC}"
    cd "$project_dir"
    
    # Build for ARM64 (Graviton2) - cheaper and faster
    cargo lambda build --release --arm64
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${function_name} built successfully${NC}"
    else
        echo -e "${RED}❌ Failed to build ${function_name}${NC}"
        exit 1
    fi
    
    cd - > /dev/null
}

# Build Scraper Lambda
echo ""
echo "Building Scraper Lambda..."
build_lambda "../scraper-rust" "scraper"

# Build Admin API Lambda
echo ""
echo "Building Admin API Lambda..."
build_lambda "../blog-service-rust" "admin-api"

echo ""
echo -e "${GREEN}✅ All Lambda functions built successfully!${NC}"
echo ""
echo "Lambda artifacts location:"
echo "  - Scraper: scraper-rust/target/lambda/scraper/bootstrap.zip"
echo "  - Admin API: blog-service-rust/target/lambda/admin-api/bootstrap.zip"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run deploy' in infrastructure/ to deploy with CDK"
echo "  2. Or manually deploy: aws lambda update-function-code --function-name <name> --zip-file fileb://path/to/bootstrap.zip"
