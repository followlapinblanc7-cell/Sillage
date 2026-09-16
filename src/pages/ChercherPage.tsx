import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MOODS, moodLabel, type MoodId } from '../types';
import {
  formatDateShort,
  type JournalApi,
} from '../hooks/useJournal';

interface Props {
  journal: JournalApi;
}

function excerpt(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + '…';
}

export function ChercherPage({ journal }: Props) {
  const [q, setQ] = useState('');
  const [mood, setMood] = useState<MoodId | null>(null);

  const results = useMemo(
    () => journal.search(q, mood),
    [journal, q, mood],
  );

  const showResults = q.trim().length > 0 || mood !== null;

  return (
    <div className="chercher-page">
      <header className="chercher-header">
        <p className="section-label chercher-eyebrow">Chercher</p>
        <h1 className="page-title">Retrouver un jour</h1>
      </header>

      <input
        className="search-input"
        type="search"
        placeholder="Titre, lieu, humeur, un mot…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Rechercher un jour"
      />

      <div
        className="mood-chips"
        style={{ marginBottom: 18 }}
        role="group"
        aria-label="Filtrer par humeur"
      >
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mood-chip${mood === m.id ? ' active' : ''}`}
            aria-pressed={mood === m.id}
            onClick={() => setMood((prev) => (prev === m.id ? null : m.id))}
          >
            <span aria-hidden="true">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {!showResults ? (
        <p className="search-empty">
          Tape un mot ou choisis une humeur.
        </p>
      ) : results.length === 0 ? (
        <p className="search-empty">Aucun jour trouvé.</p>
      ) : (
        <div className="search-results" role="list">
          {results.map((d) => {
            const moodText = moodLabel(d.mood);
            const location = d.location.trim();
            const meta = [moodText || null, location || null]
              .filter(Boolean)
              .join(' · ');
            const snippet = excerpt(d.story);
            const title = d.title.trim() || 'Sans titre';

            return (
              <Link
                key={d.id}
                to={`/jour/${d.id}`}
                className="search-result"
                role="listitem"
              >
                <div className="search-result-date">
                  {formatDateShort(d.id)}
                </div>
                <div className="search-result-title">{title}</div>
                {snippet ? (
                  <p className="search-result-snippet">{snippet}</p>
                ) : null}
                {meta ? (
                  <div className="search-result-meta">{meta}</div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
