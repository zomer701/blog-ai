############################
# Builder
############################
FROM rust:1.81-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release

############################
# Runtime (includes Chromium/Playwright deps)
############################
FROM mcr.microsoft.com/playwright:v1.45.0-jammy-arm64

WORKDIR /app
COPY --from=builder /app/target/release/rust_playwright_crawler /usr/local/bin/rust_playwright_crawler

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

EXPOSE 3001

CMD ["rust_playwright_crawler"]
