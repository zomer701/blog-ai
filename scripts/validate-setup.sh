#!/bin/bash

# Validate Setup Script
# Checks if all prerequisites are installed and configured

echo "🔍 Validating Setup"
echo "==================="
echo ""

ERRORS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check function
check_command() {
    local cmd=$1
    local name=$2
    
    if command -v $cmd &> /dev/null; then
        echo -e "${GREEN}✅ $name installed${NC}"
        $cmd --version 2>&1 | head -n 1
    else
        echo -e "${RED}❌ $name not found${NC}"
        ((ERRORS++))
    fi
    echo ""
}

# Check required tools
echo "Checking required tools..."
echo ""

check_command "rustc" "Rust"
check_command "cargo" "Cargo"
check_command "node" "Node.js"
check_command "npm" "npm"
check_command "aws" "AWS CLI"
check_command "docker" "Docker"

# Check optional tools
echo "Checking optional tools..."
echo ""

if command -v cargo-lambda &> /dev/null; then
    echo -e "${GREEN}✅ cargo-lambda installed${NC}"
    cargo-lambda --version
else
    echo -e "${YELLOW}⚠️  cargo-lambda not found (needed for Lambda deployment)${NC}"
    echo "Install: pip3 install cargo-lambda"
fi
echo ""

if command -v cdk &> /dev/null; then
    echo -e "${GREEN}✅ AWS CDK installed${NC}"
    cdk --version
else
    echo -e "${YELLOW}⚠️  AWS CDK not found (needed for infrastructure deployment)${NC}"
    echo "Install: npm install -g aws-cdk"
fi
echo ""

# Check AWS credentials
echo "Checking AWS configuration..."
echo ""

if aws sts get-caller-identity &> /dev/null; then
    echo -e "${GREEN}✅ AWS credentials configured${NC}"
    aws sts get-caller-identity --query 'Account' --output text
else
    echo -e "${RED}❌ AWS credentials not configured${NC}"
    echo "Run: aws configure"
    ((ERRORS++))
fi
echo ""

# Check Docker
echo "Checking Docker..."
echo ""

if docker ps &> /dev/null; then
    echo -e "${GREEN}✅ Docker is running${NC}"
else
    echo -e "${YELLOW}⚠️  Docker is not running (needed for local DynamoDB)${NC}"
    echo "Start Docker Desktop or run: docker-compose up -d"
fi
echo ""

# Check project structure
echo "Checking project structure..."
echo ""

if [ -d "scraper-rust" ]; then
    echo -e "${GREEN}✅ scraper-rust/ exists${NC}"
else
    echo -e "${RED}❌ scraper-rust/ not found${NC}"
    ((ERRORS++))
fi

if [ -d "blog-service-rust" ]; then
    echo -e "${GREEN}✅ blog-service-rust/ exists${NC}"
else
    echo -e "${RED}❌ blog-service-rust/ not found${NC}"
    ((ERRORS++))
fi

if [ -d "admin-ui" ]; then
    echo -e "${GREEN}✅ admin-ui/ exists${NC}"
else
    echo -e "${RED}❌ admin-ui/ not found${NC}"
    ((ERRORS++))
fi

if [ -d "infrastructure" ]; then
    echo -e "${GREEN}✅ infrastructure/ exists${NC}"
else
    echo -e "${RED}❌ infrastructure/ not found${NC}"
    ((ERRORS++))
fi
echo ""

# Check Lambda builds
echo "Checking Lambda builds..."
echo ""

if [ -d "scraper-rust/target/lambda/scraper" ]; then
    echo -e "${GREEN}✅ Scraper Lambda built${NC}"
else
    echo -e "${YELLOW}⚠️  Scraper Lambda not built yet${NC}"
    echo "Run: ./scripts/build-lambda.sh"
fi

if [ -d "blog-service-rust/target/lambda/admin-api" ]; then
    echo -e "${GREEN}✅ Admin API Lambda built${NC}"
else
    echo -e "${YELLOW}⚠️  Admin API Lambda not built yet${NC}"
    echo "Run: ./scripts/build-lambda.sh"
fi
echo ""

# Summary
echo "================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Setup validation passed!${NC}"
    echo ""
    echo "You're ready to:"
    echo "  - Run locally: docker-compose up -d && ./scripts/init-local-tables.sh"
    echo "  - Deploy to AWS: make deploy"
else
    echo -e "${RED}❌ Setup validation failed with $ERRORS error(s)${NC}"
    echo ""
    echo "Please fix the errors above before proceeding."
    exit 1
fi
