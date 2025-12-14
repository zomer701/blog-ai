import { Articles } from '../../../lib/storageData';
import { ArticlePageClient } from './ArticlePageClient';
import { notFound } from 'next/navigation';
import { type Language } from '@/lib/articleUtils';

type PageProps = {
  params: { id: string } | Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const article = Articles.find((item) => item.id === resolvedParams.id);

  if (!article) {
    notFound();
  }

  const initialLanguage: Language = 'en';

  return <ArticlePageClient article={article} initialLanguage={initialLanguage} />;
}

export function generateStaticParams() {
  return Articles.map((article) => ({
    id: article.id,
  }));
}
