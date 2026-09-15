import { Link } from 'react-router-dom';
import {
  coverPhoto,
  formatDateShort,
  hasContent,
  type JournalApi,
} from '../hooks/useJournal';

interface Props {
  journal: JournalApi;
}

export function AlbumPage({ journal }: Props) {
  const days = journal.visibleDays.filter(
    (d) => !d.private && hasContent(d) && d.photos.length > 0,
  );

  return (
    <div>
      <h1 className="page-title">Album</h1>
      <p className="page-sub">Tes jours en images</p>

      {days.length === 0 ? (
        <div className="album-empty" style={{ width: '100%', aspectRatio: 'auto', minHeight: 160 }}>
          Aucune photo pour l&apos;instant.
        </div>
      ) : (
        <div className="album-grid">
          {days.map((d) => {
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
