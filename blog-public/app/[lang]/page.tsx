import Home from '../page';

export default function LangPage() {
  return <Home />;
}

export function generateStaticParams() {
  return ['en', 'es', 'ukr'].map((lang) => ({ lang }));
}
