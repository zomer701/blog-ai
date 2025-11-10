# AI Blog Scraper & Republisher

Automated system for scraping AI/tech blogs, translating content, and publishing with admin review workflow.

## 🎯 Overview

Complete serverless blog aggregation platform that:
- **Scrapes** articles from testai, HuggingFace, TechCrunch
- **Translates** to Spanish and Ukrainian using AI
- **Provides** admin dashboard for review and editing
- **Publishes** to public-facing website with multi-language support

**Monthly Cost**: ~$11-26 | **Deployment Time**: ~15 minutes | **Performance**: 10x faster with caching

## ✨ Features

### Automated Scraping
- ⏰ Scheduled daily via EventBridge
- 🕷️ Modular parsers for each blog source
- 🔍 Two-step process: listing → article pages
- 📸 Automatic image downloading to S3
- 🚫 Duplicate detection

### AI Translation
- 🌍 Spanish and Ukrainian translations
- 🤖 Amazon Bedrock Claude Haiku
- ✏️ Manual edit tracking with timestamps
- 💰 Cost-optimized model selection

### Admin Dashboard
- 🔐 Cognito JWT authentication
- 📝 Review pending articles
- ✏️ Edit content and translations
- ✅ Approve/reject workflow
- 📊 Analytics dashboard

### Public Website
- 📱 Responsive Next.js app
- 🌐 Multi-language support (EN/ES/UK)
- 🔑 API key authentication
- 📊 View tracking
- ⚡ Fast and SEO-friendly
- 🚀 Multi-layer caching (10x faster)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interfaces                       │
│                                                           │
│  Admin UI (React)          Blog Public (Next.js)        │
│  └─────────┬───────────────────┬─────────┘             │
│            │                   │                         │
│            └────────┬──────────┘                         │
│                     │                                    │
│                     ▼                                    │
│          ┌──────────────────┐                           │
│          │  API (Rust+Axum) │                           │
│          └────────┬─────────┘                           │
│                   │                                      │
│        ┌──────────┼──────────┐                          │
│        │          │          │                          │
│        ▼          ▼          ▼                          │
│   DynamoDB       S3      Bedrock                        │
│        ▲                                                 │
│        │                                                 │
│   ┌────┴─────┐                                          │
│   │ Scraper  │ ← EventBridge (daily)                   │
│   │ (Lambda) │                                          │
│   └──────────┘                                          │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.70+
- AWS CLI configured
- cargo-lambda installed

### 1. Admin Dashboard

```bash
cd admin-ui
npm install
npm start
# Access: http://localhost:3000
```

### 2. Public Website

```bash
cd blog-public
cp .env.local.example .env.local
# Edit .env.local with API URL and key
npm install
npm run dev
# Access: http://localhost:3000
```

### 3. Deploy Scraper

```bash
cd scraper-rust
cargo lambda build --release --arm64
cargo lambda deploy
```

### 4. Deploy Infrastructure

```bash
cd infrastructure
npm install
npm run deploy
```

## 📁 Project Structure

```
ai-blog/
├── admin-ui/              # React admin dashboard
├── blog-public/           # Next.js public website
├── blog-service-rust/     # Rust API service
├── scraper-rust/          # Lambda scraper
├── infrastructure/        # AWS CDK
└── scripts/               # Utility scripts
```

## 🔧 Configuration

### Environment Variables

**Admin UI** (`.env`):
```bash
REACT_APP_API_URL=http://localhost:3001
REACT_APP_COGNITO_USER_POOL_ID=us-east-1_ABC123
REACT_APP_COGNITO_CLIENT_ID=abc123def456
```

**Blog Public** (`.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_KEY=your-api-key
```

**Scraper** (Lambda environment):
```bash
TABLE_NAME=ArticlesTable
BUCKET_NAME=blog-content-bucket
MAX_ARTICLES_PER_SITE=10
RUST_LOG=info
```

## 📖 Documentation

### Quick Start
- **[Getting Started](GETTING_STARTED.md)** ⭐ - Deploy in 15 minutes

### Core Documentation
- [Architecture](ARCHITECTURE.md) - System design and components
- [Local Development](LOCAL_DEVELOPMENT.md) - Development setup
- [Apps Overview](APPS_OVERVIEW.md) - All applications guide

### Performance & Optimization
- [Caching Strategy](CACHING_STRATEGY.md) - Multi-layer caching (10x faster)
- [Performance Guide](PERFORMANCE.md) - Optimization and monitoring

### Component Documentation
- [Scraper README](scraper-rust/README.md) - Lambda scraper details
- [Scraper Deployment](scraper-rust/DEPLOYMENT.md) - Deployment guide
- [Blog Public README](blog-public/README.md) - Public website guide
- [Blog Public Quick Start](blog-public/QUICKSTART.md) - 3-minute setup
- [Infrastructure README](infrastructure/README.md) - CDK deployment

## 🔄 Workflow

### 1. Scraping (Automated)
```
EventBridge → Lambda → Parse blogs → Translate → DynamoDB (pending)
```

### 2. Admin Review
```
Admin UI → Review → Edit → Approve/Reject → DynamoDB (approved/rejected)
```

### 3. Publishing
```
Admin UI → Publish → Generate HTML → S3 → DynamoDB (published)
```

### 4. Public Access
```
Blog Public → API → DynamoDB → Display (with language selection)
```

## 💰 Cost Breakdown

### Basic Setup (Recommended for <50K requests/month)
| Service | Monthly Cost |
|---------|-------------|
| Lambda (scraper) | $2.00 |
| Lambda (API) | $0.12 (with caching) |
| DynamoDB | $0.80 (with caching) |
| S3 (content + backups) | $0.35 |
| Bedrock (translation) | $5.00 |
| CloudFront (production) | $2.00 |
| CloudFront (staging) | $1.00 |
| API Gateway | $0.10 |
| Cognito | Free |
| CloudWatch | $0.50 |
| **Total** | **~$12/month** |

### With API Gateway Cache (For >50K requests/month)
| Additional Cost | $15/month |
|----------------|-----------|
| **Total** | **~$27/month** |

**Performance**: 10x faster response times with caching enabled  
**Smart Publishing**: +$2/month (staging distribution + backup storage)

## 🛠️ Development

### Run All Services Locally

```bash
# Terminal 1: API Service
cd blog-service-rust
cargo run

# Terminal 2: Admin UI
cd admin-ui
npm start

# Terminal 3: Public Website
cd blog-public
npm run dev
```

### Test Scraper Locally

```bash
cd scraper-rust
cargo run
```

### Deploy Everything

```bash
# Infrastructure
cd infrastructure
npm run deploy

# Scraper
cd scraper-rust
make deploy

# API
cd blog-service-rust
cargo lambda build --release --arm64
cargo lambda deploy
```

## 🔐 Security

- **Admin UI**: Cognito JWT authentication
- **Blog Public**: API key authentication (optional)
- **API**: Cognito for admin, API key for public
- **Lambda**: IAM roles with least privilege
- **S3**: Private buckets with CloudFront OAI

## 📊 Monitoring

### CloudWatch Logs
- `/aws/lambda/blog-scraper` - Scraper execution logs
- `/aws/lambda/blog-service` - API request logs

### Metrics
- Lambda invocations and errors
- DynamoDB read/write capacity
- API Gateway requests
- CloudFront cache hit ratio

## 🧪 Testing

```bash
# Scraper tests
cd scraper-rust
cargo test

# API tests
cd blog-service-rust
cargo test

# Admin UI tests
cd admin-ui
npm test

# Public website tests
cd blog-public
npm test
```

## 🚢 Deployment

### Production Checklist

- [ ] Deploy infrastructure (CDK)
- [ ] Deploy scraper Lambda
- [ ] Deploy API Lambda
- [ ] Build and deploy Admin UI
- [ ] Build and deploy Blog Public
- [ ] Create Cognito admin users
- [ ] Configure custom domains
- [ ] Set up monitoring alerts
- [ ] Test end-to-end workflow

### CI/CD

GitHub Actions workflows included for:
- Automated testing
- Lambda deployment
- Infrastructure updates

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test locally
5. Submit pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: See `/docs` folder
- **Architecture**: See `ARCHITECTURE.md`
- **Local Setup**: See `LOCAL_DEVELOPMENT.md`

## 🎯 Recent Updates

### Smart Publishing System ✨ NEW!

Enterprise-grade **modular publishing** workflow with staging, production, and rollback capabilities.

**Key Innovation: Modular Architecture**
- 🎯 **PDP (Article Pages)** - Publish individual articles independently
- 🎯 **PLP (Listing Page)** - Publish homepage independently
- ⚡ **10-100x Faster** - Only regenerate what changed
- 💰 **90% Cheaper** - Fewer S3 operations

**Features:**
- 🔒 **Staging Environment** - Preview before going live
- 💾 **Automatic Backups** - Per-article and per-PLP backups
- ⏮️ **One-Click Rollback** - Restore any version within 30 days
- 📊 **Complete Audit Trail** - Track who published what and when
- ⚡ **Zero Downtime** - Production stays live during staging
- 🌍 **Multi-Language** - EN/ES/UK with language switching
- 📄 **Static HTML** - Fast (10-50ms), cheap (~$2/month)
- 🔍 **API for Dynamic** - Search, filter, analytics only
- 💰 **Low Cost** - Total ~$12/month

**Workflow:**
```
PDP: pending → approved → staged (preview) → published (live)
PLP: article list changes → staged (preview) → published (live)
Both: rollback to any version
```

**Documentation:**
- [Getting Started](GETTING_STARTED.md) ⭐ - Complete setup guide (new to Rust? Start here!)
- [Smart Publishing Overview](SMART_PUBLISHING.md) - Architecture and design
- [Modular Publishing](MODULAR_PUBLISHING.md) - Why modular is better
- [Setup Guide](SMART_PUBLISHING_SETUP.md) - Deployment instructions
- [Quick Start](SMART_PUBLISHING_QUICKSTART.md) - 5-minute setup
- [Implementation Complete](IMPLEMENTATION_COMPLETE.md) - What's built

## 🎯 Roadmap

- [ ] RSS feed generation
- [ ] Email notifications
- [ ] Advanced search
- [ ] Category management
- [ ] User comments
- [ ] Social sharing
- [ ] Mobile apps
- [ ] More blog sources

---

**Built with** ❤️ **using Rust, React, and Next.js**
