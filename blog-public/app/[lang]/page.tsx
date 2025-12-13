import Home from '../page';

export const dynamicParams = false;

export default function LangPage() {
  return <Home />;
}

export function generateStaticParams() {
  return ['ukr', 'es', 'en'].map((lang) => ({ lang }));
}
