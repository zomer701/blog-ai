import type { Article } from './api';

export const sampleArticles: Article[] = [
  {
    id: 'sample-openai-o1',
    source: 'OpenAI',
    source_url: 'https://openai.com/index/how-confessions-can-keep-language-models-honest/',
    title: 'How “confessions” can keep language models honest',
    author: 'OpenAI Research',
    published_date: '2024-12-03T08:00:00Z',
    scraped_at: Date.now(),
    status: 'published',
    content: {
      original_html: '',
      text: 'OpenAI describes a new technique where models are prompted to “confess” their internal reasoning, reducing hallucinations and making outputs more auditable. The approach explores transparency prompts and calibration to keep models honest on factual tasks.',
      images: ['https://images.unsplash.com/photo-1527443224154-d3033dc0bac0?auto=format&fit=crop&w=1200&q=80'],
    },
    translations: {
      es: {
        title: 'Cómo las “confesiones” pueden mantener honestos a los modelos',
        content:
          'OpenAI explora pedirle a los modelos que “confiesen” su razonamiento interno para reducir alucinaciones y mejorar la auditabilidad. El enfoque usa prompts de transparencia y calibración para mantener respuestas factuals.',
        edited: false,
      },
      uk: {
        title: 'Як “зізнання” допомагають зберегти чесність мовних моделей',
        content:
          'OpenAI описує техніку, де моделі просять “зізнатися” у своєму міркуванні, що зменшує галюцинації та робить відповіді більш прозорими. Використовуються промпти прозорості й калібрування для кращої фактичності.',
        edited: false,
      },
    },
    metadata: {
      word_count: 180,
      reading_time: '2 min read',
      tags: ['OpenAI1', 'openai1', '#o11', '#reasoning2'],
    },
  },
  {
    id: 'sample-anthropic',
    source: 'Anthropic',
    source_url: 'https://www.anthropic.com/news/disrupting-AI-espionage',
    title: 'Anthropic on disrupting AI espionage',
    author: 'Anthropic Team',
    published_date: '2024-12-02T12:00:00Z',
    scraped_at: Date.now(),
    status: 'published',
    content: {
      original_html: '',
      text: 'Anthropic details countermeasures against AI-enabled espionage, including monitoring for covert data exfiltration, adaptive controls, and red-teaming. The post outlines best practices for securing AI systems in sensitive environments.',
      images: ['https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80'],
    },
    translations: {
      es: {
        title: 'Anthropic y la lucha contra el espionaje con IA',
        content:
          'Anthropic describe medidas contra el espionaje asistido por IA: monitoreo de exfiltración, controles adaptativos y red teaming. Comparten prácticas para asegurar sistemas de IA en entornos sensibles.',
        edited: false,
      },
      uk: {
        title: 'Anthropic про протидію шпигунству з ШІ',
        content:
          'Anthropic пояснює протидію шпигунству через ШІ: виявлення прихованої ексфільтрації, адаптивні контролі та red teaming. Наводять поради для захисту систем у чутливих середовищах.',
        edited: false,
      },
    },
    metadata: {
      word_count: 160,
      reading_time: '2 min read',
      tags: ['Anthropic1', 'anthropic1', '#agents1'],
    },
  },
  {
    id: 'sample-arxiv',
    source: 'arXiv',
    source_url: 'https://arxiv.org/abs/2407.09252',
    title: 'ArXiv: Inference-time scaling wins against bigger LMs',
    author: 'Artemij Kuprijanov et al.',
    published_date: '2024-07-15T07:00:00Z',
    scraped_at: Date.now(),
    status: 'published',
    content: {
      original_html: '',
      text: 'A recent arXiv paper benchmarks inference-time scaling—multiple sampled trajectories with lightweight reranking—and shows it outperforming single-pass reasoning from larger LMs on math and coding tasks. The authors highlight that compute spent at inference can beat parameter count.',
      images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'],
    },
    translations: {
      es: {
        title: 'Paper en arXiv: el escalado en inferencia supera a LMs más grandes',
        content:
          'Un paper reciente muestra que el escalado en tiempo de inferencia—trayectorias múltiples con reranking ligero—supera el razonamiento de un solo paso de LMs grandes en tareas de matemáticas y código. Más computo en inferencia puede ganar a más parámetros.',
        edited: false,
      },
      uk: {
        title: 'Новий препринт: масштабування на інференсі випереджає більші моделі',
        content:
          'Дослідження показує, що багаторазове семплування з легким reranking на інференсі перевершує одноразове міркування великих моделей у математиці та коді. Обчислення під час відповіді можуть бути корисніші за кількість параметрів.',
        edited: false,
      },
    },
    metadata: {
      word_count: 140,
      reading_time: '1 min read',
      tags: ['arXiv1', 'arxiv1', '#reasoning2'],
    },
  },
];
