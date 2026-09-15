import type { DayEntry } from '../types';

/** Today fixed for demo: mardi 15 septembre 2026 */
export const DEMO_TODAY = '2026-09-15';

export const SAMPLE_DAYS: DayEntry[] = [
  {
    id: '2026-09-13',
    title: 'Dimanche lent à la maison',
    story:
      "Matinée tardive. Un café près de la fenêtre, la lumière douce sur le parquet. Rien d'urgent — juste le silence du dimanche et l'odeur du torréfié. J'ai relu deux pages d'un livre commencé la semaine dernière, sans avancer vraiment. Ce n'est pas grave.",
    mood: 'calme',
    location: 'Saint-Étienne, Loire',
    photos: [
      {
        id: 'p13-1',
        url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
        pinned: true,
      },
    ],
    private: false,
    pinned: false,
    updatedAt: '2026-09-13T18:00:00.000Z',
  },
  {
    id: '2026-09-14',
    title: 'Premier cours de la semaine',
    story:
      "Trois cours d'affilée. La voix un peu rauque dès midi. Un élève qui d'habitude décroche a levé la main — une question juste, posée calmement. Ça a changé le ton de l'après-midi. Le stylo a glissé sur le cahier jusqu'à la dernière heure.",
    mood: 'las',
    location: 'Saint-Étienne',
    photos: [
      {
        id: 'p14-1',
        url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80',
        pinned: true,
      },
    ],
    private: false,
    pinned: false,
    updatedAt: '2026-09-14T20:30:00.000Z',
  },
  {
    id: '2026-09-15',
    title: "J'ai aidé un élève aujourd'hui",
    story:
      "Lina est restée après le cours. Fractions — elle bloquait depuis des semaines. On a repris lentement, avec des pommes découpées sur le bureau. Et puis ça a cliqué. Son visage s'est ouvert. Sur le chemin du retour, j'étais plus légère.\n\n« Ce n'est pas un grand jour. C'est un vrai. »",
    mood: 'joyeux',
    location: 'Saint-Étienne',
    photos: [
      {
        id: 'p15-1',
        url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
        pinned: true,
      },
      {
        id: 'p15-2',
        url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&q=80',
        pinned: false,
      },
    ],
    private: false,
    pinned: true,
    updatedAt: '2026-09-15T17:45:00.000Z',
  },
];
