import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { DayEntry, MoodId } from '../types';
import { MOODS } from '../types';

interface Props {
  /** Same visibility rules as Fil — never includes coffre days. */
  visibleDays: DayEntry[];
  /** Local today id YYYY-MM-DD (calendar month derived from this). */
  today: string;
}

function monthNameFr(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const raw = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function MoisGlimpse({ visibleDays, today }: Props) {
  const ym = today.slice(0, 7);

  const { count, moodPhrase } = useMemo(() => {
    const days = visibleDays.filter((d) => d.id.startsWith(ym));
    const tallies = new Map<MoodId, number>();
    for (const d of days) {
      if (!d.mood) continue;
      tallies.set(d.mood, (tallies.get(d.mood) ?? 0) + 1);
    }
    // MOODS order keeps texture calm and predictable
    const parts = MOODS.filter((m) => tallies.has(m.id)).map((m) => {
      const n = tallies.get(m.id)!;
      return n > 1 ? `${m.icon} ${m.label} ×${n}` : `${m.icon} ${m.label}`;
    });
    return {
      count: days.length,
      moodPhrase: parts.join(' · '),
    };
  }, [visibleDays, ym]);

  const label = monthNameFr(ym);

  return (
    <section
      className="mois-glimpse"
      aria-label={`Ce mois — ${label}`}
    >
      <Link to="/calendrier" className="mois-glimpse-link">
        <h2 className="mois-glimpse-title">Ce mois</h2>
        {count === 0 ? (
          <p className="mois-glimpse-empty">
            Pas encore de trace ce mois-ci.
          </p>
        ) : (
          <>
            <p className="mois-glimpse-days">
              {count === 1 ? '1 jour écrit' : `${count} jours écrits`}
            </p>
            {moodPhrase ? (
              <p className="mois-glimpse-moods">{moodPhrase}</p>
            ) : null}
          </>
        )}
        <p className="mois-glimpse-open">Ouvrir le calendrier</p>
      </Link>
    </section>
  );
}
