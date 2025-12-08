import type { Article } from './api';

export const sampleArticles: Article[] = [
  {
    id: 'sample-openai-o1',
    source: 'OpenAI',
    source_url: 'https://openai.com/index/introducing-openai-o1/',
    title: 'OpenAI launches O1 models to boost reasoning and reliability',
    author: 'OpenAI Research',
    published_date: '2024-09-12T08:00:00Z',
    scraped_at: Date.now(),
    status: 'published',
    content: {
      original_html: '',
      text: 'OpenAI introduced the O1 model family focused on step-by-step reasoning, fewer refusals, and stronger tool use. The launch adds a faster O1-mini, improved safety defaults, and early access to native reasoning traces for enterprise customers.',
      images: ['https://images.unsplash.com/photo-1527443224154-d3033dc0bac0?auto=format&fit=crop&w=1200&q=80'],
    },
    translations: {
      es: {
        title: 'OpenAI lanza la familia O1 para mejorar el razonamiento',
        content:
          'OpenAI presentó la familia O1 enfocada en razonamiento paso a paso, menos rechazos y mejor uso de herramientas. Incluye O1-mini más rápido, nuevas protecciones y trazas de razonamiento para clientes enterprise.',
        edited: false,
      },
      uk: {
        title: 'OpenAI запускає модельну лінійку O1 для кращого мислення',
        content:
          'OpenAI представила серію O1 з фокусом на покрокове міркування, менше відмов і кращу роботу з інструментами. Додано швидшу O1-mini, більше безпеки та трасування міркувань для enterprise.',
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
    source_url: 'https://example.com/anthropic/claude',
    title: 'Anthropic debuts Claude workflows for long-running agents',
    author: 'Nikhil Rao',
    published_date: '2024-11-18T12:00:00Z',
    scraped_at: Date.now(),
    status: 'published',
    content: {
      original_html: '',
      text: 'Claude workflows string together multiple calls with safe-tooling to handle longer research and review tasks. Early testers report stronger auditability and fewer prompt collisions compared to classic chains.',
      images: ['https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1200&q=80'],
    },
    translations: {
      es: {
        title: 'Anthropic lanza flujos Claude para agentes de larga duración',
        content:
          'Claude ahora une múltiples llamadas con herramientas seguras para tareas más largas. Los primeros usuarios reportan mejor trazabilidad y menos colisiones de prompts frente a cadenas clásicas.',
        edited: false,
      },
      uk: {
        title: 'Anthropic представила Claude workflows для довгих задач',
        content:
          'Claude тепер поєднує кілька викликів із безпечними інструментами для тривалих завдань. Тестувальники бачать кращу аудитовність і менше конфліктів підказок порівняно з класичними ланцюжками.',
        edited: false,
      },
    },
    metadata: {
      word_count: 160,
      reading_time: '2 min read',
      tags: ['Anthropic1', 'anthropic1', 'claude1', '#agents1'],
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
