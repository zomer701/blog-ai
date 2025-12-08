import Home from '../page';

export default function LangPage() {
  return <Home />;
}

export function generateStaticParams() {
  return ['en', 'es', 'uk'].map((lang) => ({ lang }));
}
