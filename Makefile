# AI Blog Scraper & Republisher - Makefile
# Comprehensive build and deployment automation

.PHONY: help
help:
	@echo "AI Blog Scraper - Available Commands"
	@echo "===================================="
	@echo ""
	@echo "Local Development:"
	@echo "  make setup              - Install all dependencies"
	@echo "  make build              - Build all services"
	@echo "  make test               - Run all tests"
	@echo "  make run-scraper        - Run scraper locally"
	@echo "  make run-api            - Run admin API locally"
	@echo "  make run-ui             - Run admin UI locally"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy             - Deploy everything to AWS"
	@echo "  make deploy-quick       - Quick deploy (Lambda only)"
	@echo "  make build-lambda       - Build Lambda functions"
	@echo "  make update-scraper     - Update scraper Lambda"
	@echo "  make update-api         - Update admin API Lambda"
	@echo ""
	@echo "Testing & Monitoring:"
	@echo "  make test-deployment    - Validate AWS deployment"
	@echo "  make logs-scraper       - View scraper logs"
	@echo "  make logs-api           - View admin API logs"
	@echo "  make create-user        - Create admin user (EMAIL=user@example.com)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean              - Clean build artifacts"
	@echo "  make destroy            - Destroy AWS infrastructure"

# ========================================
# Setup and Installation
# ========================================

.PHONY: setup
setup: setup-rust setup-node setup-tools
	@echo "✅ Setup complete!"

.PHONY: setup-rust
setup-rust:
	@echo "📦 Setting up Rust..."
	@rustup update stable
	@rustup target add aarch64-unknown-linux-gnu

.PHONY: setup-node
setup-node:
	@echo "📦 Setting up Node.js dependencies..."
	@cd infrastructure && npm install
	@cd admin-ui && npm install

.PHONY: setup-tools
setup-tools:
	@echo "🔧 Installing required tools..."
	@pip3 install cargo-lambda || echo "cargo-lambda already installed"
	@npm install -g aws-cdk || echo "aws-cdk already installed"

# ========================================
# Build Commands
# ========================================

.PHONY: build
build: build-scraper build-api build-ui
	@echo "✅ All services built!"

.PHONY: build-scraper
build-scraper:
	@echo "🔨 Building scraper..."
	@cd scraper-rust && cargo build --release

.PHONY: build-api
build-api:
	@echo "🔨 Building admin API..."
	@cd blog-service-rust && cargo build --release

.PHONY: build-ui
build-ui:
	@echo "🔨 Building admin UI..."
	@cd admin-ui && npm run build

.PHONY: build-lambda
build-lambda:
	@echo "🚀 Building Lambda functions..."
	@chmod +x scripts/build-lambda.sh
	@./scripts/build-lambda.sh

# ========================================
# Test Commands
# ========================================

.PHONY: test
test: test-scraper test-api test-ui
	@echo "✅ All tests passed!"

.PHONY: test-scraper
test-scraper:
	@echo "🧪 Testing scraper..."
	@cd scraper-rust && cargo test

.PHONY: test-api
test-api:
	@echo "🧪 Testing admin API..."
	@cd blog-service-rust && cargo test

.PHONY: test-ui
test-ui:
	@echo "🧪 Testing admin UI..."
	@cd admin-ui && npm test -- --passWithNoTests

.PHONY: lint
lint: lint-scraper lint-api lint-ui
	@echo "✅ All linting passed!"

.PHONY: lint-scraper
lint-scraper:
	@echo "🔍 Linting scraper..."
	@cd scraper-rust && cargo fmt -- --check
	@cd scraper-rust && cargo clippy -- -D warnings

.PHONY: lint-api
lint-api:
	@echo "🔍 Linting admin API..."
	@cd blog-service-rust && cargo fmt -- --check
	@cd blog-service-rust && cargo clippy -- -D warnings

.PHONY: lint-ui
lint-ui:
	@echo "🔍 Linting admin UI..."
	@cd admin-ui && npm run lint

# ========================================
# Local Development
# ========================================

.PHONY: run-scraper
run-scraper:
	@echo "🚀 Running scraper locally..."
	@cd scraper-rust && cargo run

.PHONY: run-api
run-api:
	@echo "🚀 Running admin API locally..."
	@cd blog-service-rust && cargo run

.PHONY: run-ui
run-ui:
	@echo "🚀 Running admin UI locally..."
	@cd admin-ui && npm start

# ========================================
# Deployment Commands
# ========================================

.PHONY: deploy
deploy:
	@echo "☁️  Deploying to AWS..."
	@chmod +x scripts/deploy.sh
	@./scripts/deploy.sh

.PHONY: deploy-quick
deploy-quick: build-lambda
	@echo "⚡ Quick deploying Lambda functions..."
	@cd infrastructure && npm run deploy

.PHONY: update-scraper
update-scraper:
	@echo "🔄 Updating scraper Lambda..."
	@chmod +x scripts/update-lambda.sh
	@./scripts/update-lambda.sh scraper

.PHONY: update-api
update-api:
	@echo "🔄 Updating admin API Lambda..."
	@chmod +x scripts/update-lambda.sh
	@./scripts/update-lambda.sh admin-api

.PHONY: update-all
update-all:
	@echo "🔄 Updating all Lambda functions..."
	@chmod +x scripts/update-lambda.sh
	@./scripts/update-lambda.sh all

# ========================================
# Testing & Monitoring
# ========================================

.PHONY: test-deployment
test-deployment:
	@echo "🧪 Testing deployment..."
	@chmod +x scripts/test-deployment.sh
	@./scripts/test-deployment.sh

.PHONY: logs-scraper
logs-scraper:
	@echo "📋 Viewing scraper logs..."
	@chmod +x scripts/logs.sh
	@./scripts/logs.sh scraper --tail

.PHONY: logs-api
logs-api:
	@echo "📋 Viewing admin API logs..."
	@chmod +x scripts/logs.sh
	@./scripts/logs.sh admin-api --tail

.PHONY: create-user
create-user:
	@echo "👤 Creating admin user..."
	@chmod +x scripts/create-admin-user.sh
	@./scripts/create-admin-user.sh $(EMAIL)

# ========================================
# Cleanup Commands
# ========================================

.PHONY: clean
clean:
	@echo "🧹 Cleaning build artifacts..."
	@cd scraper-rust && cargo clean
	@cd blog-service-rust && cargo clean
	@cd admin-ui && rm -rf build node_modules
	@cd infrastructure && rm -rf cdk.out node_modules
	@echo "✅ Cleanup complete!"

.PHONY: destroy
destroy:
	@echo "💥 Destroying AWS infrastructure..."
	@cd infrastructure && cdk destroy --all
	@echo "✅ Infrastructure destroyed!"

# ========================================
# Utility Commands
# ========================================

.PHONY: status
status:
	@echo "📊 Checking deployment status..."
	@aws cloudformation describe-stacks \
		--stack-name AiBlogInfrastructureStack \
		--query 'Stacks[0].StackStatus' \
		--output text 2>/dev/null || echo "Stack not deployed"

.PHONY: outputs
outputs:
	@echo "📋 Stack outputs:"
	@aws cloudformation describe-stacks \
		--stack-name AiBlogInfrastructureStack \
		--query 'Stacks[0].Outputs' \
		--output table

.PHONY: invoke-scraper
invoke-scraper:
	@echo "🚀 Invoking scraper Lambda..."
	@aws lambda invoke \
		--function-name ai-blog-scraper \
		--payload '{"test": true}' \
		output.json
	@cat output.json
	@rm output.json

# ========================================
# Development Workflow
# ========================================

.PHONY: dev
dev: setup build test
	@echo "✅ Development environment ready!"

.PHONY: ci
ci: lint test build-lambda
	@echo "✅ CI checks passed!"

# Default target
.DEFAULT_GOAL := help
