import type { Article } from './api';
import indexData from '../public/articles/index.json';

const now = Date.now();

export const Articles: Article[] = (indexData as Article[]).map((article) => ({
  ...article,
  scraped_at: article.scraped_at || now,
}));
