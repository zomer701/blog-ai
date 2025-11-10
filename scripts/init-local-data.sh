#!/bin/bash
set -e

# Initialize Local Sample Data
# Populates DynamoDB with sample articles for testing

echo "📝 Initializing Sample Data"
echo "==========================="

ENDPOINT="http://localhost:8000"
TABLE="ArticlesTable"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if table exists
echo "Checking if ArticlesTable exists..."
if ! aws dynamodb describe-table --table-name $TABLE --endpoint-url $ENDPOINT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  ArticlesTable doesn't exist${NC}"
    echo "Run: ./scripts/init-local-tables.sh first"
    exit 1
fi

echo -e "${GREEN}✅ ArticlesTable found${NC}"
echo ""

# Function to add article
add_article() {
    local id=$1
    local status=$2
    local title=$3
    local source=$4
    
    echo -e "${BLUE}Adding: $title ($status)${NC}"
    
    aws dynamodb put-item \
      --table-name $TABLE \
      --item "{
        \"id\": {\"S\": \"$id\"},
        \"status\": {\"S\": \"$status\"},
        \"created_at\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"},
        \"source\": {\"S\": \"$source\"},
        \"source_url\": {\"S\": \"https://$source.com/blog/$id\"},
        \"title\": {\"S\": \"$title\"},
        \"content\": {\"S\": \"This is sample content for $title. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\"},
        \"title_es\": {\"S\": \"[ES] $title\"},
        \"content_es\": {\"S\": \"Este es contenido de muestra para $title. Lorem ipsum dolor sit amet.\"},
        \"title_uk\": {\"S\": \"[UK] $title\"},
        \"content_uk\": {\"S\": \"Це зразковий вміст для $title. Lorem ipsum dolor sit amet.\"},
        \"author\": {\"S\": \"Sample Author\"},
        \"published_date\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"},
        \"scraped_at\": {\"N\": \"$(date +%s)\"},
        \"title_es_edited\": {\"BOOL\": false},
        \"content_es_edited\": {\"BOOL\": false},
        \"title_uk_edited\": {\"BOOL\": false},
        \"content_uk_edited\": {\"BOOL\": false}
      }" \
      --endpoint-url $ENDPOINT \
      > /dev/null
}

# Add pending articles (for review)
echo -e "${YELLOW}Creating pending articles...${NC}"
add_article "pending-1" "pending" "Introduction to GPT-4 Turbo" "testai"
add_article "pending-2" "pending" "New Transformers Library Release" "huggingface"
add_article "pending-3" "pending" "AI Startup Raises $100M Series B" "techcrunch"
add_article "pending-4" "pending" "testai Announces DALL-E 3" "testai"
add_article "pending-5" "pending" "Hugging Face Launches New Model Hub" "huggingface"

# Add approved articles (ready to publish)
echo ""
echo -e "${YELLOW}Creating approved articles...${NC}"
add_article "approved-1" "approved" "ChatGPT Enterprise Launch" "testai"
add_article "approved-2" "approved" "Open Source LLM Comparison" "huggingface"
add_article "approved-3" "approved" "Google Announces Gemini AI" "techcrunch"

# Add published articles (visible on public site)
echo ""
echo -e "${YELLOW}Creating published articles...${NC}"
add_article "published-1" "published" "The Future of AI in 2024" "testai"
add_article "published-2" "published" "Building Better Language Models" "huggingface"

echo ""
echo -e "${GREEN}✅ Sample data initialized successfully!${NC}"
echo ""
echo "Summary:"
echo "  - 5 pending articles (for review)"
echo "  - 3 approved articles (ready to publish)"
echo "  - 2 published articles (visible on public site)"
echo ""
echo "View data:"
echo "  aws dynamodb scan --table-name ArticlesTable --endpoint-url $ENDPOINT"
echo ""
echo "Query by status:"
echo "  aws dynamodb query \\"
echo "    --table-name ArticlesTable \\"
echo "    --index-name status-created_at-index \\"
echo "    --key-condition-expression \"status = :status\" \\"
echo "    --expression-attribute-values '{\":status\":{\"S\":\"pending\"}}' \\"
echo "    --endpoint-url $ENDPOINT"
echo ""
echo "Next steps:"
echo "  1. Start API: cd blog-service-rust && cargo run"
echo "  2. Start UI: cd admin-ui && npm start"
echo "  3. Open: http://localhost:3000"
