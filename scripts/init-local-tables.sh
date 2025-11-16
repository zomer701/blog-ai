#!/bin/bash
set -e

# Initialize Local DynamoDB Tables
# Creates ArticlesTable and AnalyticsTable for local development

echo "🗄️  Initializing Local DynamoDB Tables"
echo "======================================"

ENDPOINT="http://localhost:8082"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if DynamoDB Local is running
echo "Checking DynamoDB Local..."
if ! curl -s $ENDPOINT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  DynamoDB Local is not running${NC}"
    echo "Start it with: docker-compose up -d"
    exit 1
fi

echo -e "${GREEN}✅ DynamoDB Local is running${NC}"

# Delete existing tables if they exist
echo ""
echo "Cleaning up existing tables..."
aws dynamodb delete-table --table-name ArticlesTable --endpoint-url $ENDPOINT 2>/dev/null || true
aws dynamodb delete-table --table-name AnalyticsTable --endpoint-url $ENDPOINT 2>/dev/null || true
sleep 2

# Create ArticlesTable
echo ""
echo "Creating ArticlesTable..."
aws dynamodb create-table \
  --table-name ArticlesTable \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=status,AttributeType=S \
    AttributeName=created_at,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=status-created_at-index,\
     KeySchema=[{AttributeName=status,KeyType=HASH},{AttributeName=created_at,KeyType=RANGE}],\
     Projection={ProjectionType=ALL},\
     ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}" \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --endpoint-url $ENDPOINT \
  > /dev/null

echo -e "${GREEN}✅ ArticlesTable created${NC}"

# Create AnalyticsTable
echo ""
echo "Creating AnalyticsTable..."
aws dynamodb create-table \
  --table-name AnalyticsTable \
  --attribute-definitions \
    AttributeName=article_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=article_id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --endpoint-url $ENDPOINT \
  > /dev/null

echo -e "${GREEN}✅ AnalyticsTable created${NC}"

# Verify tables
echo ""
echo "Verifying tables..."
TABLES=$(aws dynamodb list-tables --endpoint-url $ENDPOINT --query 'TableNames' --output text)
echo "Tables: $TABLES"

echo ""
echo -e "${GREEN}✅ Local DynamoDB tables initialized successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/init-local-data.sh (to add sample data)"
echo "  2. Start scraper: cd scraper-rust && cargo run"
echo "  3. Start API: cd blog-service-rust && cargo run"
