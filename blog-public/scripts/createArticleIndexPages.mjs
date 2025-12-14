import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_INDEX = path.join(ROOT, 'public', 'articles', 'index.json');
const OUT_DIR = path.join(ROOT, 'out', 'article');

function loadArticles() {
  if (!fs.existsSync(ARTICLES_INDEX)) {
    console.warn(`Skipping article index copy; ${ARTICLES_INDEX} not found.`);
    return [];
  }
  const raw = fs.readFileSync(ARTICLES_INDEX, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse articles index:', error);
    return [];
  }
}

function ensureIndexPages(articles) {
  if (!fs.existsSync(OUT_DIR)) {
    console.warn(`Skipping index page creation; ${OUT_DIR} does not exist.`);
    return;
  }

  for (const article of articles) {
    if (!article?.id) continue;
    const htmlFile = path.join(OUT_DIR, `${article.id}.html`);
    if (!fs.existsSync(htmlFile)) continue;

    const targetDir = path.join(OUT_DIR, article.id);
    const targetIndex = path.join(targetDir, 'index.html');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(htmlFile, targetIndex);
  }
}

function main() {
  const articles = loadArticles();
  ensureIndexPages(articles);
}

main();
