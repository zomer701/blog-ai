#!/bin/bash
set -e

# Smart Publishing System Test Script
# Tests the complete workflow: staging → production → rollback

echo "🧪 Testing Smart Publishing System"
echo "=================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
TOKEN="${ADMIN_TOKEN:-}"

if [ -z "$TOKEN" ]; then
    echo "❌ Error: ADMIN_TOKEN environment variable not set"
    echo "   export ADMIN_TOKEN=your-jwt-token"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Test 1: Create test article
echo "Test 1: Creating test article..."
ARTICLE_ID=$(curl -s -X POST "$API_URL/admin/articles" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Test Article for Smart Publishing",
        "content": "This is a test article to verify the smart publishing workflow.",
        "status": "approved"
    }' | jq -r '.id')

if [ -z "$ARTICLE_ID" ] || [ "$ARTICLE_ID" = "null" ]; then
    error "Failed to create test article"
    exit 1
fi

success "Created test article: $ARTICLE_ID"
echo ""

# Test 2: Publish to staging
echo "Test 2: Publishing to staging..."
STAGING_RESPONSE=$(curl -s -X POST "$API_URL/admin/articles/$ARTICLE_ID/publish-staging" \
    -H "Authorization: Bearer $TOKEN")

STAGING_URL=$(echo "$STAGING_RESPONSE" | jq -r '.staging_url')

if [ -z "$STAGING_URL" ] || [ "$STAGING_URL" = "null" ]; then
    error "Failed to publish to staging"
    echo "$STAGING_RESPONSE"
    exit 1
fi

success "Published to staging: $STAGING_URL"
echo ""

# Test 3: Check staging status
echo "Test 3: Checking publishing status..."
STATUS_RESPONSE=$(curl -s "$API_URL/admin/articles/$ARTICLE_ID/publishing-status" \
    -H "Authorization: Bearer $TOKEN")

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')

if [ "$STATUS" != "staged" ]; then
    error "Expected status 'staged', got '$STATUS'"
    exit 1
fi

success "Article status: $STATUS"
echo ""

# Test 4: Publish to production
echo "Test 4: Publishing to production..."
info "This will create a backup..."

PROD_RESPONSE=$(curl -s -X POST "$API_URL/admin/articles/$ARTICLE_ID/publish-production" \
    -H "Authorization: Bearer $TOKEN")

PROD_URL=$(echo "$PROD_RESPONSE" | jq -r '.production_url')
VERSION=$(echo "$PROD_RESPONSE" | jq -r '.version')

if [ -z "$PROD_URL" ] || [ "$PROD_URL" = "null" ]; then
    error "Failed to publish to production"
    echo "$PROD_RESPONSE"
    exit 1
fi

success "Published to production: $PROD_URL (version $VERSION)"
echo ""

# Test 5: List backups
echo "Test 5: Listing backups..."
BACKUPS=$(curl -s "$API_URL/admin/backups" \
    -H "Authorization: Bearer $TOKEN")

BACKUP_COUNT=$(echo "$BACKUPS" | jq '. | length')

if [ "$BACKUP_COUNT" -lt 1 ]; then
    error "No backups found (expected at least 1)"
    exit 1
fi

success "Found $BACKUP_COUNT backup(s)"
echo "$BACKUPS" | jq -r '.[] | "  - \(.timestamp) (created: \(.created_at))"'
echo ""

# Test 6: Rollback
echo "Test 6: Testing rollback..."
info "Rolling back to latest backup..."

ROLLBACK_RESPONSE=$(curl -s -X POST "$API_URL/admin/rollback" \
    -H "Authorization: Bearer $TOKEN")

ROLLBACK_MESSAGE=$(echo "$ROLLBACK_RESPONSE" | jq -r '.message')

if [ -z "$ROLLBACK_MESSAGE" ]; then
    error "Rollback failed"
    echo "$ROLLBACK_RESPONSE"
    exit 1
fi

success "Rollback successful: $ROLLBACK_MESSAGE"
echo ""

# Test 7: Verify CloudFront invalidation (if enabled)
if [ "$CLOUDFRONT_ENABLED" = "true" ]; then
    echo "Test 7: Checking CloudFront invalidation..."
    info "Waiting 10 seconds for invalidation to start..."
    sleep 10
    
    # Check if invalidation was created (this would require AWS CLI)
    if command -v aws &> /dev/null; then
        DIST_ID="${PRODUCTION_DISTRIBUTION_ID}"
        if [ -n "$DIST_ID" ]; then
            INVALIDATIONS=$(aws cloudfront list-invalidations \
                --distribution-id "$DIST_ID" \
                --max-items 1 \
                --query 'InvalidationList.Items[0].Status' \
                --output text 2>/dev/null || echo "")
            
            if [ -n "$INVALIDATIONS" ]; then
                success "CloudFront invalidation status: $INVALIDATIONS"
            else
                info "Could not check invalidation status"
            fi
        fi
    else
        info "AWS CLI not available, skipping CloudFront check"
    fi
    echo ""
fi

# Summary
echo "=================================="
echo "🎉 All tests passed!"
echo ""
echo "Summary:"
echo "  ✅ Article created: $ARTICLE_ID"
echo "  ✅ Published to staging: $STAGING_URL"
echo "  ✅ Published to production: $PROD_URL (v$VERSION)"
echo "  ✅ Backups created: $BACKUP_COUNT"
echo "  ✅ Rollback successful"
echo ""
echo "Smart Publishing system is working correctly! 🚀"
