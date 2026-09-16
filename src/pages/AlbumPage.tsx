import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  coverPhoto,
  formatDateShort,
  type JournalApi,
} from '../hooks/useJournal';

interface Props {
  journal: JournalApi;
}

/** « septembre 2026 » — capitalize first letter. */
function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const raw = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function AlbumPage({ journal }: Props) {
  const days = journal.visibleDays.filter((d) => d.photos.length > 0);
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const d of days) {
      set.add(d.id.slice(0, 7)); // YYYY-MM
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [days]);

  const filtered =
    monthFilter === 'all' ? days : days.filter((d) => d.id.startsWith(monthFilter));

  return (
    <div>
      <h1 className="page-title">Album</h1>
      <p className="page-sub">Les images que tu gardes</p>

      {days.length > 0 && (
        <div className="month-chips" role="list">
          <button
            type="button"
            className={`mood-chip${monthFilter === 'all' ? ' active' : ''}`}
            onClick={() => setMonthFilter('all')}
          >
            Tout
          </button>
          {months.map((ym) => (
            <button
              key={ym}
              type="button"
              className={`mood-chip${monthFilter === ym ? ' active' : ''}`}
              onClick={() => setMonthFilter(ym)}
            >
              {formatMonthLabel(ym)}
            </button>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <div className="album-empty" style={{ width: '100%', aspectRatio: 'auto', minHeight: 160 }}>
          Aucune photo pour l&apos;instant.
        </div>
      ) : filtered.length === 0 ? (
        <p className="muted album-month-empty">Aucune photo ce mois-ci.</p>
      ) : (
        <div className="album-grid">
          {filtered.map((d) => {
            const cover = coverPhoto(d);
            return (
              <Link key={d.id} to={`/jour/${d.id}`} className="album-cover">
                {cover ? (
                  <img src={cover} alt="" loading="lazy" />
                ) : (
                  <div className="album-empty">Sans image</div>
                )}
                <div className="overlay">
                  <span className="date">{formatDateShort(d.id)}</span>
                  <span className="title">{d.title.trim() || 'Sans titre'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
