import { Articles } from '../../../lib/storageData';
import { ArticlePageClient } from './ArticlePageClient';

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  return <ArticlePageClient id={resolvedParams.id} />;
}

export function generateStaticParams() {
  return Articles.map((article) => ({
    id: article.id,
  }));
}
