#!/bin/bash

# View Lambda Function Logs
# Usage: ./logs.sh [scraper|admin-api] [--tail] [--filter "pattern"]

echo "📋 Lambda Function Logs"
echo "======================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPONENT=${1:-scraper}
REGION="${AWS_REGION:-us-east-1}"
TAIL_MODE=false
FILTER_PATTERN=""

# Parse arguments
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --tail)
            TAIL_MODE=true
            shift
            ;;
        --filter)
            FILTER_PATTERN="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Determine function name
case $COMPONENT in
    scraper)
        FUNCTION_NAME="ai-blog-scraper"
        ;;
    admin-api|admin)
        FUNCTION_NAME="ai-blog-admin-api"
        ;;
    *)
        echo -e "${RED}Invalid component: $COMPONENT${NC}"
        echo "Usage: $0 [scraper|admin-api] [--tail] [--filter \"pattern\"]"
        exit 1
        ;;
esac

LOG_GROUP="/aws/lambda/$FUNCTION_NAME"

echo "Viewing logs for: $FUNCTION_NAME"
echo "Log Group: $LOG_GROUP"
echo ""

# Check if log group exists
if ! aws logs describe-log-groups \
    --log-group-name-prefix "$LOG_GROUP" \
    --region "$REGION" \
    --query 'logGroups[0]' \
    --output text > /dev/null 2>&1; then
    echo -e "${RED}❌ Log group not found. Has the function been invoked?${NC}"
    exit 1
fi

if [ "$TAIL_MODE" = true ]; then
    echo -e "${BLUE}📡 Tailing logs (Ctrl+C to stop)...${NC}"
    echo ""
    
    if [ -n "$FILTER_PATTERN" ]; then
        aws logs tail "$LOG_GROUP" \
            --follow \
            --format short \
            --filter-pattern "$FILTER_PATTERN" \
            --region "$REGION"
    else
        aws logs tail "$LOG_GROUP" \
            --follow \
            --format short \
            --region "$REGION"
    fi
else
    echo -e "${BLUE}📄 Recent logs (last 10 minutes)...${NC}"
    echo ""
    
    START_TIME=$(($(date +%s) - 600))000  # 10 minutes ago in milliseconds
    
    if [ -n "$FILTER_PATTERN" ]; then
        aws logs filter-log-events \
            --log-group-name "$LOG_GROUP" \
            --start-time "$START_TIME" \
            --filter-pattern "$FILTER_PATTERN" \
            --region "$REGION" \
            --query 'events[*].[timestamp,message]' \
            --output text | while IFS=$'\t' read -r timestamp message; do
                date_str=$(date -r $((timestamp / 1000)) '+%Y-%m-%d %H:%M:%S')
                echo "[$date_str] $message"
            done
    else
        aws logs tail "$LOG_GROUP" \
            --since 10m \
            --format short \
            --region "$REGION"
    fi
fi

echo ""
echo "Examples:"
echo "  View recent logs:     $0 scraper"
echo "  Tail logs:            $0 scraper --tail"
echo "  Filter errors:        $0 scraper --filter ERROR"
echo "  Admin API logs:       $0 admin-api --tail"
