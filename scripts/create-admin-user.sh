#!/bin/bash
set -e

# Create Admin User in Cognito
# Usage: ./create-admin-user.sh <email> [password]

echo "👤 Creating Admin User"
echo "====================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check arguments
if [ $# -lt 1 ]; then
    echo -e "${RED}Usage: $0 <email> [password]${NC}"
    echo "Example: $0 admin@example.com MySecurePass123"
    exit 1
fi

EMAIL=$1
PASSWORD=${2:-$(openssl rand -base64 12)}
STACK_NAME="AiBlogInfrastructureStack"
REGION="${AWS_REGION:-us-east-1}"

# Get User Pool ID from CloudFormation outputs
echo "Getting User Pool ID from stack..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

if [ -z "$USER_POOL_ID" ]; then
    echo -e "${RED}❌ Could not find User Pool ID. Is the stack deployed?${NC}"
    exit 1
fi

echo "User Pool ID: $USER_POOL_ID"

# Create user
echo ""
echo "Creating user: $EMAIL"
aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username $EMAIL \
    --user-attributes Name=email,Value=$EMAIL Name=email_verified,Value=true \
    --temporary-password "$PASSWORD" \
    --message-action SUPPRESS \
    --region $REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ User created successfully${NC}"
    
    # Set permanent password
    echo "Setting permanent password..."
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username $EMAIL \
        --password "$PASSWORD" \
        --permanent \
        --region $REGION
    
    echo ""
    echo -e "${GREEN}✅ Admin user ready!${NC}"
    echo ""
    echo "Login credentials:"
    echo "  Email: $EMAIL"
    echo "  Password: $PASSWORD"
    echo ""
    echo -e "${YELLOW}⚠️  Save these credentials securely!${NC}"
else
    echo -e "${RED}❌ Failed to create user${NC}"
    exit 1
fi
