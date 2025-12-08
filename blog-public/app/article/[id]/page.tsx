import { sampleArticles } from '@/lib/sampleData';
import { ArticlePageClient } from './ArticlePageClient';

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <ArticlePageClient id={resolvedParams.id} />;
}

export function generateStaticParams() {
  return sampleArticles.map((article) => ({
    id: article.id,
  }));
}
