#!/bin/bash
set -e

# Test Deployment Script
# Validates that all components are working correctly

echo "🧪 Testing Deployment"
echo "===================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

STACK_NAME="AiBlogInfrastructureStack"
REGION="${AWS_REGION:-us-east-1}"
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo ""
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS${NC}"
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((FAILED_TESTS++))
    fi
}

# Get stack outputs
echo "Getting stack outputs..."
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs' \
    --output json)

# Extract values
TABLE_NAME=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ArticlesTableName") | .OutputValue')
BUCKET_NAME=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ContentBucketName") | .OutputValue')
API_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ApiUrl") | .OutputValue')
SCRAPER_FUNCTION=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ScraperFunctionName") | .OutputValue')
ADMIN_FUNCTION=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="AdminApiFunctionName") | .OutputValue')

echo ""
echo "Testing components:"
echo "  DynamoDB Table: $TABLE_NAME"
echo "  S3 Bucket: $BUCKET_NAME"
echo "  API URL: $API_URL"
echo "  Scraper Function: $SCRAPER_FUNCTION"
echo "  Admin API Function: $ADMIN_FUNCTION"

# Test 1: DynamoDB Table exists
run_test "DynamoDB Table" \
    "aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION > /dev/null 2>&1"

# Test 2: S3 Bucket exists
run_test "S3 Bucket" \
    "aws s3 ls s3://$BUCKET_NAME --region $REGION > /dev/null 2>&1"

# Test 3: Scraper Lambda exists
run_test "Scraper Lambda Function" \
    "aws lambda get-function --function-name $SCRAPER_FUNCTION --region $REGION > /dev/null 2>&1"

# Test 4: Admin API Lambda exists
run_test "Admin API Lambda Function" \
    "aws lambda get-function --function-name $ADMIN_FUNCTION --region $REGION > /dev/null 2>&1"

# Test 5: API Gateway is accessible
run_test "API Gateway Health Check" \
    "curl -s -o /dev/null -w '%{http_code}' ${API_URL}health | grep -q '200\|404'"

# Test 6: Invoke Scraper Lambda (dry run)
echo ""
echo -e "${BLUE}Testing: Scraper Lambda Invocation${NC}"
SCRAPER_OUTPUT=$(mktemp)
aws lambda invoke \
    --function-name $SCRAPER_FUNCTION \
    --region $REGION \
    --payload '{"test": true}' \
    $SCRAPER_OUTPUT > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    echo "Response:"
    cat $SCRAPER_OUTPUT | jq '.' 2>/dev/null || cat $SCRAPER_OUTPUT
else
    echo -e "${RED}❌ FAIL${NC}"
    ((FAILED_TESTS++))
fi
rm -f $SCRAPER_OUTPUT

# Test 7: Check EventBridge Rule
run_test "EventBridge Scraper Schedule" \
    "aws events list-rules --region $REGION --name-prefix ScraperScheduleRule | jq -e '.Rules | length > 0' > /dev/null 2>&1"

# Summary
echo ""
echo "================================"
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "Your deployment is working correctly."
    exit 0
else
    echo -e "${RED}❌ $FAILED_TESTS test(s) failed${NC}"
    echo ""
    echo "Please check the logs and fix the issues."
    exit 1
fi
