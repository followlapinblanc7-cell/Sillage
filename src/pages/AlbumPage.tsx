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
  const [loadedCovers, setLoadedCovers] = useState<Record<string, true>>({});

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
    <div className="album-page">
      <header className="album-header">
        <p className="section-label album-eyebrow">Album</p>
        <h1 className="page-title">Les images que tu gardes</h1>
        <p className="page-sub album-sub">Chaque jour sa couverture</p>
      </header>

      {days.length > 0 && (
        <div
          className="month-chips"
          role="group"
          aria-label="Filtrer par mois"
        >
          <button
            type="button"
            className={`mood-chip month-chip${monthFilter === 'all' ? ' active' : ''}`}
            aria-pressed={monthFilter === 'all'}
            onClick={() => setMonthFilter('all')}
          >
            Tout
          </button>
          {months.map((ym) => (
            <button
              key={ym}
              type="button"
              className={`mood-chip month-chip${monthFilter === ym ? ' active' : ''}`}
              aria-pressed={monthFilter === ym}
              onClick={() => setMonthFilter(ym)}
            >
              {formatMonthLabel(ym)}
            </button>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <div className="album-empty-state" role="status">
          <p className="album-empty-quote">
            « L&apos;album attend encore ses premières images. »
          </p>
          <p className="album-empty-hint">
            Ajoute une photo depuis un jour — elle trouvera sa place ici.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="album-empty-state album-empty-state--month" role="status">
          <p className="album-empty-quote">
            « Ce mois-ci, aucune image n&apos;a encore été gardée. »
          </p>
          <p className="album-empty-hint">
            Choisis un autre mois, ou reviens quand tu auras accroché une photo.
          </p>
        </div>
      ) : (
        <div className="album-grid">
          {filtered.map((d) => {
            const cover = coverPhoto(d);
            const title = d.title.trim() || 'Sans titre';
            return (
              <Link
                key={d.id}
                to={`/jour/${d.id}`}
                className="album-cover"
                aria-label={`${title}, ${formatDateShort(d.id)}`}
              >
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    className={loadedCovers[d.id] ? 'is-loaded' : undefined}
                    onLoad={() =>
                      setLoadedCovers((prev) =>
                        prev[d.id] ? prev : { ...prev, [d.id]: true },
                      )
                    }
                  />
                ) : (
                  <div className="album-cover-fallback">Sans image</div>
                )}
                <div className="overlay">
                  <span className="date">{formatDateShort(d.id)}</span>
                  <span className="title">{title}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
