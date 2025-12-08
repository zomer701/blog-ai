import { sampleArticles } from '@/lib/sampleData';
import { ArticlePageClient } from './ArticlePageClient';

type PageProps = {
  params: { id: string };
};

export default function Page({ params }: PageProps) {
  return <ArticlePageClient id={params.id} />;
}

export function generateStaticParams() {
  return sampleArticles.map((article) => ({
    id: article.id,
  }));
}
