#!/bin/bash
set -e

# Update Lambda Function Code
# Usage: ./update-lambda.sh [scraper|admin-api|all]

echo "🔄 Update Lambda Functions"
echo "=========================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPONENT=${1:-all}
REGION="${AWS_REGION:-us-east-1}"

# Function to update a Lambda
update_lambda() {
    local project_dir=$1
    local function_name=$2
    local zip_path=$3
    
    echo ""
    echo -e "${YELLOW}📦 Building ${function_name}...${NC}"
    cd "$project_dir"
    cargo lambda build --release --arm64
    cd - > /dev/null
    
    echo -e "${YELLOW}☁️  Updating ${function_name} in AWS...${NC}"
    aws lambda update-function-code \
        --function-name "$function_name" \
        --zip-file "fileb://${zip_path}" \
        --region "$REGION" \
        --no-cli-pager
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${function_name} updated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to update ${function_name}${NC}"
        exit 1
    fi
}

# Update based on component
case $COMPONENT in
    scraper)
        update_lambda \
            "scraper-rust" \
            "ai-blog-scraper" \
            "scraper-rust/target/lambda/scraper/bootstrap.zip"
        ;;
    admin-api)
        update_lambda \
            "blog-service-rust" \
            "ai-blog-admin-api" \
            "blog-service-rust/target/lambda/admin-api/bootstrap.zip"
        ;;
    all)
        update_lambda \
            "scraper-rust" \
            "ai-blog-scraper" \
            "scraper-rust/target/lambda/scraper/bootstrap.zip"
        
        update_lambda \
            "blog-service-rust" \
            "ai-blog-admin-api" \
            "blog-service-rust/target/lambda/admin-api/bootstrap.zip"
        ;;
    *)
        echo -e "${RED}Invalid component: $COMPONENT${NC}"
        echo "Usage: $0 [scraper|admin-api|all]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Lambda update complete!${NC}"
echo ""
echo "To test the updated function:"
echo "  aws lambda invoke --function-name <function-name> output.json"
