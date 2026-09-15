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

export function ChercherPage({ journal }: Props) {
  const [q, setQ] = useState('');
  const [mood, setMood] = useState<MoodId | null>(null);

  const results = useMemo(
    () => journal.search(q, mood),
    [journal, q, mood],
  );

  const showResults = q.trim().length > 0 || mood !== null;

  return (
    <div>
      <h1 className="page-title">Chercher</h1>
      <p className="page-sub">Retrouver un jour</p>

      <input
        className="search-input"
        type="search"
        placeholder="Titre, histoire, lieu, humeur…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Rechercher"
      />

      <div className="mood-chips" style={{ marginBottom: 18 }}>
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mood-chip${mood === m.id ? ' active' : ''}`}
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
        <div>
          {results.map((d) => (
            <Link key={d.id} to={`/jour/${d.id}`} className="search-result">
              <div className="t">{d.title.trim() || 'Sans titre'}</div>
              <div className="m">
                {[
                  formatDateShort(d.id),
                  moodLabel(d.mood) || null,
                  d.location.trim() || null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
