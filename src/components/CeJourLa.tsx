import { Link } from 'react-router-dom';
import type { DayEntry } from '../types';
import { coverPhoto } from '../hooks/useJournal';

interface Props {
  /** Past same calendar-day entries (already filtered; hide when empty). */
  days: DayEntry[];
}

function oneLineExcerpt(text: string, max = 88): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

function yearOf(id: string): string {
  return id.slice(0, 4);
}

/**
 * Quiet resurfacing of souvenirs from the same month-day in earlier years.
 * Distinct from « Une trace » (one curated past day, any date).
 */
export function CeJourLa({ days }: Props) {
  if (days.length === 0) return null;

  return (
    <section className="ce-jour-la" aria-label="Ce jour-là">
      <h2 className="ce-jour-la-title">Ce jour-là</h2>
      <p className="ce-jour-la-sub">Même date, d&apos;autres années.</p>
      <ul className="ce-jour-la-list">
        {days.map((d) => {
          const thumb = coverPhoto(d);
          const title = d.title.trim() || 'Sans titre';
          const excerpt = oneLineExcerpt(d.story);
          return (
            <li key={d.id}>
              <Link to={`/jour/${d.id}`} className="ce-jour-la-item">
                {thumb ? (
                  <img
                    className="ce-jour-la-cover"
                    src={thumb}
                    alt=""
                    loading="lazy"
                  />
                ) : null}
                <div className="ce-jour-la-body">
                  <span className="ce-jour-la-year">{yearOf(d.id)}</span>
                  <h3 className="ce-jour-la-item-title">{title}</h3>
                  {excerpt ? (
                    <p className="ce-jour-la-excerpt">{excerpt}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
