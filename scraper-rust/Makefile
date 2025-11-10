.PHONY: build deploy test clean logs invoke

# Build for Lambda (ARM64)
build:
	cargo lambda build --release --arm64

# Build for local testing (x86_64)
build-local:
	cargo build --release

# Deploy to AWS using SAM
deploy: build
	sam deploy --guided

# Deploy without prompts (uses samconfig.toml)
deploy-fast: build
	sam deploy

# Run tests
test:
	cargo test

# Clean build artifacts
clean:
	cargo clean
	rm -rf .aws-sam

# Watch Lambda logs
logs:
	sam logs -n BlogScraperFunction --tail

# Invoke Lambda locally
invoke-local: build
	sam local invoke BlogScraperFunction

# Invoke Lambda in AWS
invoke:
	aws lambda invoke \
		--function-name blog-scraper \
		--payload '{}' \
		response.json
	cat response.json
	rm response.json

# Check code
check:
	cargo check
	cargo clippy

# Format code
fmt:
	cargo fmt

# Run locally (not Lambda)
run-local:
	cargo run

# Install dependencies
install-deps:
	cargo install cargo-lambda
	pip install aws-sam-cli

# Show help
help:
	@echo "Available targets:"
	@echo "  build         - Build for Lambda (ARM64)"
	@echo "  build-local   - Build for local testing"
	@echo "  deploy        - Deploy to AWS (guided)"
	@echo "  deploy-fast   - Deploy to AWS (no prompts)"
	@echo "  test          - Run tests"
	@echo "  clean         - Clean build artifacts"
	@echo "  logs          - Watch Lambda logs"
	@echo "  invoke-local  - Test Lambda locally"
	@echo "  invoke        - Invoke Lambda in AWS"
	@echo "  check         - Check code and run clippy"
	@echo "  fmt           - Format code"
	@echo "  run-local     - Run locally (not Lambda)"
	@echo "  install-deps  - Install cargo-lambda and SAM CLI"
