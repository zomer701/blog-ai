# Quick Start Guide

Get the blog public website running in 3 minutes.

## Step 1: Setup Environment

```bash
cd blog-public

# Copy environment template
cp .env.local.example .env.local

# Edit with your API details
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
# NEXT_PUBLIC_API_KEY=your-key
```

## Step 2: Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Step 3: Access

Open http://localhost:3000

## What You'll See

### Homepage
- List of all published articles
- Language switcher (EN/ES/UK)
- Article cards with:
  - Source badge
  - Publication date
  - Title (in selected language)
  - Preview text
  - Author
  - Reading time

### Article Page
- Full article content
- Language switcher
- Source link
- Tags
- Auto-tracked views (analytics)

## Testing Without API

If you don't have the API running yet, you'll see:
- "Error loading articles" message
- "Try again" button

To test with mock data, create `lib/mock-data.ts`:

```typescript
export const mockArticles = [
  {
    id: '1',
    source: 'testai',
    source_url: 'https://testai.com/blog/example',
    title: 'Example Article',
    author: 'John Doe',
    published_date: '2024-01-01',
    scraped_at: Date.now(),
    status: 'published',
    content: {
      original_html: '<p>Content</p>',
      text: 'This is example content...',
      images: [],
    },
    translations: {
      es: {
        title: 'Artículo de Ejemplo',
        content: 'Este es contenido de ejemplo...',
        edited: false,
      },
      uk: {
        title: 'Приклад Статті',
        content: 'Це приклад вмісту...',
        edited: false,
      },
    },
    metadata: {
      word_count: 500,
      reading_time: '3 min',
      tags: ['AI', 'Technology'],
    },
  },
];
```

## Next Steps

1. **Connect to Real API**
   - Start blog-service-rust API
   - Update `.env.local` with correct URL
   - Add API key if required

2. **Customize Styling**
   - Edit `app/globals.css`
   - Modify Tailwind classes
   - Update colors/fonts

3. **Add Features**
   - Search functionality
   - Category filters
   - Related articles
   - Comments

4. **Deploy**
   - Push to GitHub
   - Deploy to Vercel
   - Configure environment variables

## Common Issues

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

### API Connection Failed

1. Check API is running
2. Verify URL in `.env.local`
3. Check CORS settings
4. Verify API key

### Build Errors

```bash
# Clear and reinstall
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

## Development Tips

- Hot reload is enabled - changes appear instantly
- Check browser console for errors
- Use React DevTools for debugging
- Test all three languages
- Test on mobile viewport

## Ready for Production?

```bash
# Build for production
npm run build

# Test production build locally
npm start

# Deploy to Vercel
vercel
```

Done! Your blog public website is ready. 🎉
