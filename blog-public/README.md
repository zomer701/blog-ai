# Blog Public - Reader-Facing Website

Next.js app for readers to browse and read AI/tech blog articles with multi-language support. Ships with built-in sample data so you can see the UI without a backend.

## Features

- ✅ **Article Listing** - Browse all published articles
- ✅ **Article Detail** - Read full articles
- ✅ **Multi-language** - Switch between English, Spanish, Ukrainian
- ✅ **API Integration** - Connects to blog-service-rust API
- ✅ **Simple Auth** - API key authentication
- ✅ **Analytics** - Tracks article views
- ✅ **Responsive** - Mobile-friendly design
- ✅ **Fast** - Next.js with Tailwind CSS

## Quick Start (with sample data)

- No backend needed. Sample articles are served automatically if `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_API_KEY` are missing.

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Access at: http://localhost:3000 — the homepage shows a TikTok-style vertical feed using the sample articles.

### Using a real API (optional)

```bash
cp .env.local.example .env.local
```

Set your API values:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_API_KEY=your-api-key-here
```

When these are set, the app will call your API instead of sample data.

## Project Structure

```
blog-public/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Homepage (article list)
│   ├── article/
│   │   └── [id]/
│   │       └── page.tsx    # Article detail page
│   └── globals.css         # Global styles
├── lib/
│   ├── api.ts              # API client with auth + sample fallback
│   └── sampleData.ts       # Sample articles shown when no API is configured
├── .env.local.example      # Environment template
└── package.json
```

## API Integration

### API Client (`lib/api.ts`)

```typescript
import { api } from '@/lib/api';

// Get all articles
const articles = await api.getArticles(); // uses sample data if no API is set

// Get single article
const article = await api.getArticle(id); // sample fallback if offline

// Search articles
const results = await api.searchArticles(query);

// Track view (analytics)
await api.trackView(articleId); // no-op when using sample data
```

### Authentication

The API client automatically includes the API key in requests:

```typescript
headers: {
  'X-API-Key': process.env.NEXT_PUBLIC_API_KEY
}
```

## Language Switching

### Homepage

Users can switch languages using buttons in the header. The selected language affects:
- Article titles
- Article previews

### Article Page

Language selection persists via URL query parameter:
```
/article/123?lang=es
/article/123?lang=uk
```

Content is displayed in the selected language if translation exists, otherwise falls back to English.

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_KEY`

### AWS Amplify

1. Connect GitHub repository
2. Set build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
3. Add environment variables

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t blog-public .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://api.example.com blog-public
```

## Customization

### Styling

Edit `app/globals.css` or component styles. Uses Tailwind CSS.

### Branding

Update in `app/layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: "Your Blog Name",
  description: "Your description",
};
```

### Add Features

Common additions:
- Search bar
- Category filtering
- Related articles
- Comments (Disqus, etc.)
- Newsletter signup
- Social sharing
- Dark mode

## Performance

### Optimization Tips

1. **Enable ISR** (Incremental Static Regeneration):
   ```typescript
   export const revalidate = 3600; // Revalidate every hour
   ```

2. **Image Optimization**:
   ```typescript
   import Image from 'next/image';
   <Image src={url} alt={alt} width={800} height={600} />
   ```

3. **Lazy Loading**:
   ```typescript
   import dynamic from 'next/dynamic';
   const Component = dynamic(() => import('./Component'));
   ```

## Troubleshooting

### API Connection Issues

1. Check API URL in `.env.local`
2. Verify API is running
3. Check CORS settings on API
4. Verify API key is correct

### Build Errors

```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Styling Issues

```bash
# Rebuild Tailwind
npm run dev
```

## Development

### Add New Page

```bash
# Create new route
mkdir -p app/about
touch app/about/page.tsx
```

### Add API Endpoint

Edit `lib/api.ts`:
```typescript
async getPopularArticles(): Promise<Article[]> {
  return this.request<Article[]>('/articles/popular');
}
```

## Production Checklist

- [ ] Set production API URL
- [ ] Configure API key
- [ ] Enable analytics
- [ ] Add error tracking (Sentry)
- [ ] Configure CDN
- [ ] Set up monitoring
- [ ] Add sitemap
- [ ] Add robots.txt
- [ ] Configure SEO metadata
- [ ] Test all languages
- [ ] Test mobile responsiveness
- [ ] Load testing

## Support

- Next.js Docs: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- Vercel Deployment: https://vercel.com/docs
