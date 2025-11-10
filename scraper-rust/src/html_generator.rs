// HTML Generator module for creating static HTML pages
use anyhow::Result;
use crate::models::Article;
use chrono::{DateTime, Utc};

#[allow(dead_code)]
pub struct HtmlGenerator {
    site_title: String,
    site_description: String,
}

impl HtmlGenerator {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            site_title: "AI & Tech Blog".to_string(),
            site_description: "Latest news and insights from AI and technology".to_string(),
        }
    }
    
    /// Generate HTML for a single article page (PDP - Product Detail Page)
    #[allow(dead_code)]
    pub fn generate_article_html(&self, article: &Article, lang: &str) -> Result<String> {
        let (title, content) = match lang {
            "es" => {
                if let Some(ref trans) = article.translations {
                    (&trans.es.title, &trans.es.content)
                } else {
                    (&article.title, &article.content.text)
                }
            },
            "uk" => {
                if let Some(ref trans) = article.translations {
                    (&trans.uk.title, &trans.uk.content)
                } else {
                    (&article.title, &article.content.text)
                }
            },
            _ => (&article.title, &article.content.text),
        };
        
        let html = format!(r#"<!DOCTYPE html>
<html lang="{}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="{}">
    <title>{} - {}</title>
    <link rel="stylesheet" href="/static/styles.css">
    <!-- Version: {} -->
</head>
<body>
    <header>
        <nav>
            <div class="container">
                <h1><a href="/index-{}.html">{}</a></h1>
                <div class="language-switcher">
                    <span>Language:</span>
                    <a href="/articles/{}-en.html" class="{}">{}</a>
                    <a href="/articles/{}-es.html" class="{}">{}</a>
                    <a href="/articles/{}-uk.html" class="{}">{}</a>
                </div>
            </div>
        </nav>
    </header>
    
    <main class="container">
        <article>
            <header class="article-header">
                <h1>{}</h1>
                <div class="article-meta">
                    <time datetime="{}">{}</time>
                    <span class="source">Source: {}</span>
                    <span class="reading-time">{}</span>
                </div>
            </header>
            
            <div class="article-content">
                {}
            </div>
            
            <footer class="article-footer">
                <p><a href="{}" target="_blank" rel="noopener">Read original article →</a></p>
                {}
            </footer>
        </article>
        
        <!-- Analytics tracking (client-side JavaScript) -->
        <script>
            // Track page view via API
            fetch('/api/analytics/track', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{
                    article_id: '{}',
                    language: '{}',
                    timestamp: new Date().toISOString()
                }})
            }}).catch(err => console.log('Analytics tracking failed:', err));
        </script>
    </main>
    
    <footer class="site-footer">
        <div class="container">
            <p>&copy; {} {}. All rights reserved.</p>
            <p class="version-info">Version: {} | Published: {}</p>
        </div>
    </footer>
</body>
</html>"#,
            lang,
            self.escape_html(&title[..title.len().min(160)]),
            title,
            self.site_title,
            article.publishing.version,
            lang,
            self.site_title,
            article.id, if lang == "en" { "active" } else { "" }, "EN",
            article.id, if lang == "es" { "active" } else { "" }, "ES",
            article.id, if lang == "uk" { "active" } else { "" }, "UK",
            title,
            article.published_date,
            self.format_date(&article.published_date),
            article.source,
            article.metadata.reading_time,
            self.format_content(content),
            article.source_url,
            self.generate_edit_notice(article, lang),
            article.id,
            lang,
            Utc::now().format("%Y"),
            self.site_title,
            article.publishing.version,
            self.format_timestamp(article.publishing.published_at)
        );
        
        Ok(html)
    }
    
    /// Generate HTML for the listing page (PLP - Product Listing Page)
    #[allow(dead_code)]
    pub fn generate_listing_html(&self, articles: &[Article], lang: &str) -> Result<String> {
        let articles_html = articles.iter()
            .map(|article| self.generate_article_card(article, lang))
            .collect::<Vec<_>>()
            .join("\n");
        
        let (page_title, tagline, search_placeholder, filter_label) = match lang {
            "es" => (
                "Blog de IA y Tecnología",
                "Últimas noticias e información de IA y tecnología",
                "Buscar artículos...",
                "Filtrar por:"
            ),
            "uk" => (
                "Блог про ШІ та Технології",
                "Останні новини та інформація про ШІ та технології",
                "Шукати статті...",
                "Фільтрувати за:"
            ),
            _ => (
                "AI & Tech Blog",
                "Latest news and insights from AI and technology",
                "Search articles...",
                "Filter by:"
            ),
        };
        
        let html = format!(r#"<!DOCTYPE html>
<html lang="{}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="{}">
    <title>{}</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <header>
        <nav>
            <div class="container">
                <h1>{}</h1>
                <p class="tagline">{}</p>
                <div class="language-switcher">
                    <a href="/index-en.html" class="{}">{}</a>
                    <a href="/index-es.html" class="{}">{}</a>
                    <a href="/index-uk.html" class="{}">{}</a>
                </div>
            </div>
        </nav>
    </header>
    
    <main class="container">
        <!-- Search and Filter (uses API) -->
        <div class="search-filter-bar">
            <input 
                type="search" 
                id="search-input" 
                placeholder="{}" 
                class="search-input"
            />
            <select id="category-filter" class="category-filter">
                <option value="">{}</option>
                <option value="testai">testai</option>
                <option value="huggingface">HuggingFace</option>
                <option value="techcrunch">TechCrunch</option>
            </select>
        </div>
        
        <!-- Static articles grid -->
        <div class="articles-grid" id="articles-grid">
            {}
        </div>
        
        <!-- Loading indicator for dynamic content -->
        <div id="loading" class="loading" style="display:none;">Loading...</div>
    </main>
    
    <footer class="site-footer">
        <div class="container">
            <p>&copy; {} {}. All rights reserved.</p>
        </div>
    </footer>
    
    <!-- Client-side JavaScript for search/filter -->
    <script>
        const searchInput = document.getElementById('search-input');
        const categoryFilter = document.getElementById('category-filter');
        const articlesGrid = document.getElementById('articles-grid');
        const loading = document.getElementById('loading');
        
        let searchTimeout;
        
        // Search functionality (calls API)
        searchInput.addEventListener('input', (e) => {{
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 3) {{
                // Show static content if search is cleared
                location.reload();
                return;
            }}
            
            searchTimeout = setTimeout(() => {{
                performSearch(query);
            }}, 500);
        }});
        
        // Filter functionality (calls API)
        categoryFilter.addEventListener('change', (e) => {{
            const category = e.target.value;
            if (category) {{
                performFilter(category);
            }} else {{
                location.reload();
            }}
        }});
        
        async function performSearch(query) {{
            loading.style.display = 'block';
            try {{
                const response = await fetch(`/api/search?q=${{encodeURIComponent(query)}}&lang={}`);
                const data = await response.json();
                displayResults(data.articles || []);
            }} catch (err) {{
                console.error('Search failed:', err);
            }} finally {{
                loading.style.display = 'none';
            }}
        }}
        
        async function performFilter(category) {{
            loading.style.display = 'block';
            try {{
                const response = await fetch(`/api/articles?category=${{category}}&lang={}`);
                const data = await response.json();
                displayResults(data.articles || []);
            }} catch (err) {{
                console.error('Filter failed:', err);
            }} finally {{
                loading.style.display = 'none';
            }}
        }}
        
        function displayResults(articles) {{
            if (articles.length === 0) {{
                articlesGrid.innerHTML = '<p class="no-results">No articles found.</p>';
                return;
            }}
            
            articlesGrid.innerHTML = articles.map(article => `
                <article class="article-card">
                    <h2><a href="/articles/${{article.id}}-{}.html">${{article.title}}</a></h2>
                    <div class="article-meta">
                        <time>${{new Date(article.published_date).toLocaleDateString()}}</time>
                        <span class="source">${{article.source}}</span>
                    </div>
                    <p class="excerpt">${{article.excerpt || ''}}</p>
                    <a href="/articles/${{article.id}}-{}.html" class="read-more">Read more →</a>
                </article>
            `).join('');
        }}
    </script>
</body>
</html>"#,
            lang,
            tagline,
            page_title,
            page_title,
            tagline,
            if lang == "en" { "active" } else { "" }, "EN",
            if lang == "es" { "active" } else { "" }, "ES",
            if lang == "uk" { "active" } else { "" }, "UK",
            search_placeholder,
            filter_label,
            articles_html,
            Utc::now().format("%Y"),
            self.site_title,
            lang,
            lang,
            lang,
            lang
        );
        
        Ok(html)
    }
    
    /// Generate an article card for the listing page
    #[allow(dead_code)]
    fn generate_article_card(&self, article: &Article, lang: &str) -> String {
        let (title, content) = match lang {
            "es" => {
                if let Some(ref trans) = article.translations {
                    (&trans.es.title, &trans.es.content)
                } else {
                    (&article.title, &article.content.text)
                }
            },
            "uk" => {
                if let Some(ref trans) = article.translations {
                    (&trans.uk.title, &trans.uk.content)
                } else {
                    (&article.title, &article.content.text)
                }
            },
            _ => (&article.title, &article.content.text),
        };
        
        let excerpt = self.generate_excerpt(content, 200);
        let read_more_text = match lang {
            "es" => "Leer más →",
            "uk" => "Читати далі →",
            _ => "Read more →",
        };
        
        format!(r#"<article class="article-card">
    <h2><a href="/articles/{}-{}.html">{}</a></h2>
    <div class="article-meta">
        <time datetime="{}">{}</time>
        <span class="source">{}</span>
        <span class="reading-time">{}</span>
    </div>
    <p class="excerpt">{}</p>
    <a href="/articles/{}-{}.html" class="read-more">{}</a>
</article>"#,
            article.id,
            lang,
            self.escape_html(title),
            article.published_date,
            self.format_date(&article.published_date),
            article.source,
            article.metadata.reading_time,
            excerpt,
            article.id,
            lang,
            read_more_text
        )
    }
    
    /// Generate CSS stylesheet
    #[allow(dead_code)]
    pub fn generate_stylesheet(&self) -> String {
        r#"/* Reset and base styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Header */
header {
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 1rem 0;
}

header h1 {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
}

header h1 a {
    color: #2563eb;
    text-decoration: none;
}

header nav ul {
    list-style: none;
    display: flex;
    gap: 2rem;
}

header nav a {
    color: #666;
    text-decoration: none;
}

header nav a:hover {
    color: #2563eb;
}

/* Main content */
main {
    padding: 2rem 0;
}

/* Article page */
article {
    background-color: #fff;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.article-header h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: #1a1a1a;
}

.article-meta {
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 2rem;
    display: flex;
    gap: 1rem;
}

.article-footer {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #e5e5e5;
}

.edit-notice {
    background-color: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 1rem;
    margin-top: 1rem;
}

/* Listing page */
.articles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 2rem;
}

.article-card {
    background-color: #fff;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s;
}

.article-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.article-card h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
}

.article-card h2 a {
    color: #1a1a1a;
    text-decoration: none;
}

.article-card h2 a:hover {
    color: #2563eb;
}

.excerpt {
    color: #666;
    margin: 1rem 0;
}

.read-more {
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
}

/* Footer */
.site-footer {
    background-color: #1a1a1a;
    color: #fff;
    padding: 2rem 0;
    margin-top: 4rem;
    text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
    .articles-grid {
        grid-template-columns: 1fr;
    }
    
    .article-header h1 {
        font-size: 2rem;
    }
}"#.to_string()
    }
    
    // Helper methods
    
    #[allow(dead_code)]
    fn format_content(&self, content: &str) -> String {
        // Convert markdown-style content to HTML
        content
            .split("\n\n")
            .map(|para| format!("<p>{}</p>", self.escape_html(para)))
            .collect::<Vec<_>>()
            .join("\n")
    }
    
    #[allow(dead_code)]
    fn generate_excerpt(&self, content: &str, max_length: usize) -> String {
        let text = content.chars().take(max_length).collect::<String>();
        if content.len() > max_length {
            format!("{}...", text)
        } else {
            text
        }
    }
    
    #[allow(dead_code)]
    fn format_date(&self, date_str: &str) -> String {
        // Parse and format date
        if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
            dt.format("%B %d, %Y").to_string()
        } else {
            date_str.to_string()
        }
    }
    
    #[allow(dead_code)]
    fn format_timestamp(&self, timestamp: Option<i64>) -> String {
        if let Some(ts) = timestamp {
            let dt = DateTime::from_timestamp(ts, 0).unwrap_or_else(|| Utc::now());
            dt.format("%Y-%m-%d %H:%M UTC").to_string()
        } else {
            "Not published".to_string()
        }
    }
    
    #[allow(dead_code)]
    fn escape_html(&self, text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#39;")
    }
    
    #[allow(dead_code)]
    fn generate_edit_notice(&self, article: &Article, lang: &str) -> String {
        let was_edited = match lang {
            "es" => {
                if let Some(ref trans) = article.translations {
                    trans.es.edited
                } else {
                    false
                }
            },
            "uk" => {
                if let Some(ref trans) = article.translations {
                    trans.uk.edited
                } else {
                    false
                }
            },
            _ => false,
        };
        
        if was_edited {
            r#"<div class="edit-notice">
    <strong>Note:</strong> This translation has been manually reviewed and edited for accuracy.
</div>"#.to_string()
        } else {
            String::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ArticleContent, ArticleStatus, ArticleMetadata, Translation, Translations};
    
    #[test]
    fn test_html_generation() {
        let generator = HtmlGenerator::new();
        let article = Article {
            id: "test-123".to_string(),
            source: "Test Source".to_string(),
            source_url: "https://example.com/article".to_string(),
            title: "Test Article".to_string(),
            author: "Test Author".to_string(),
            published_date: "2024-01-01T00:00:00Z".to_string(),
            scraped_at: 1704067200,
            status: ArticleStatus::Published,
            content: ArticleContent {
                original_html: "<p>This is test content.</p>".to_string(),
                text: "This is test content.".to_string(),
                images: vec![],
            },
            translations: Some(Translations {
                es: Translation {
                    title: "Artículo de Prueba".to_string(),
                    content: "Este es contenido de prueba.".to_string(),
                    edited: false,
                    edited_at: None,
                },
                uk: Translation {
                    title: "Тестова Стаття".to_string(),
                    content: "Це тестовий вміст.".to_string(),
                    edited: false,
                    edited_at: None,
                },
            }),
            metadata: ArticleMetadata {
                word_count: 4,
                reading_time: "1 min".to_string(),
                tags: vec![],
            },
            publishing: crate::models::PublishingMetadata::default(),
        };
        
        let html = generator.generate_article_html(&article, "en").unwrap();
        assert!(html.contains("Test Article"));
        assert!(html.contains("This is test content"));
    }
}
