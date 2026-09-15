import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MOODS } from '../types';
import {
  formatDateLong,
  hasContent,
  type JournalApi,
} from '../hooks/useJournal';
import { fileToDataUrl } from '../lib/imageFile';

interface Props {
  journal: JournalApi;
}

export function DayPage({ journal }: Props) {
  const { id = journal.today } = useParams();
  const navigate = useNavigate();
  const day = journal.getDay(id);
  const isToday = id === journal.today;
  const [metaOpen, setMetaOpen] = useState(() =>
    !!(day.location || day.mood || day.photos.length),
  );
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const metaSummary = useMemo(() => {
    const parts: string[] = [];
    if (day.mood) {
      const m = MOODS.find((x) => x.id === day.mood);
      if (m) parts.push(`${m.icon} ${m.label}`);
    }
    if (day.location.trim()) parts.push(day.location.trim());
    if (day.photos.length) {
      const n = day.photos.length;
      parts.push(`${n} photo${n > 1 ? 's' : ''}`);
    }
    return parts.length ? parts.join(' · ') : 'Lieu, humeur, photos…';
  }, [day.mood, day.location, day.photos.length]);

  const handleDelete = () => {
    if (!hasContent(day)) {
      navigate('/');
      return;
    }
    if (window.confirm('Effacer cette journée ?')) {
      journal.deleteDay(id);
      navigate('/');
    }
  };

  const openPhotoPicker = () => {
    setPhotoError(null);
    fileInputRef.current?.click();
  };

  const onPhotosPicked = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await fileToDataUrl(file);
        journal.addPhoto(id, dataUrl);
      }
      setMetaOpen(true);
    } catch (e) {
      console.error(e);
      setPhotoError(
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? 'Stockage plein — retire une photo ou un jour.'
          : 'Impossible d’ajouter cette photo.',
      );
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="day-header">
        <Link to="/" className="back-btn" aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="badge">{isToday ? "Aujourd'hui" : 'Souvenir'}</span>
      </div>

      <p className="day-date">{formatDateLong(id)}</p>

      <input
        className="title-input"
        type="text"
        placeholder="Ajoute un titre…"
        value={day.title}
        onChange={(e) => journal.updateDay(id, { title: e.target.value })}
        aria-label="Titre"
      />

      <div className="story-label">L&apos;histoire</div>
      <textarea
        className="story-input"
        placeholder="Écris librement…"
        value={day.story}
        onChange={(e) => journal.updateDay(id, { story: e.target.value })}
        aria-label="Histoire"
      />

      <button
        type="button"
        className="meta-toggle"
        onClick={() => setMetaOpen((o) => !o)}
        aria-expanded={metaOpen}
      >
        <span>{metaSummary}</span>
        <span aria-hidden="true">{metaOpen ? '▴' : '▾'}</span>
      </button>

      {metaOpen ? (
        <div className="meta-panel">
          <div className="field-label">Lieu</div>
          <input
            className="lieu-input"
            type="text"
            placeholder="Où étais-tu ?"
            value={day.location}
            onChange={(e) => journal.updateDay(id, { location: e.target.value })}
          />

          <div className="field-label">Humeur</div>
          <div className="mood-chips">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`mood-chip${day.mood === m.id ? ' active' : ''}`}
                onClick={() =>
                  journal.setMood(id, day.mood === m.id ? null : m.id)
                }
              >
                <span aria-hidden="true">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          <div className="field-label">Photos</div>
          <div className="photos-grid">
            {day.photos.map((p) => (
              <div key={p.id} className="photo-tile">
                <img src={p.url} alt="" loading="lazy" />
                <div className="photo-actions">
                  <button
                    type="button"
                    className={p.pinned ? 'pinned' : ''}
                    title="Épingler"
                    aria-label="Épingler"
                    onClick={() => journal.pinPhoto(id, p.id)}
                  >
                    ✦
                  </button>
                  <button
                    type="button"
                    title="Retirer"
                    aria-label="Retirer la photo"
                    onClick={() => journal.removePhoto(id, p.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
                        <button
              type="button"
              className="add-photo"
              onClick={openPhotoPicker}
              disabled={photoBusy}
            >
              <span aria-hidden="true">＋</span>
              {photoBusy ? 'Ajout…' : 'Ajouter'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              hidden
              onChange={(e) => onPhotosPicked(e.target.files)}
            />

          </div>

          {photoError ? (
            <p className="muted" style={{ marginTop: 10 }} role="alert">
              {photoError}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => journal.updateDay(id, { pinned: !day.pinned })}
            >
              {day.pinned ? 'Désépingler le jour' : 'Épingler le jour'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => journal.updateDay(id, { private: !day.private })}
            >
              {day.private ? 'Rendre public' : 'Privé'}
            </button>
          </div>
        </div>
      ) : null}

      <button type="button" className="btn-danger" onClick={handleDelete}>
        Effacer cette journée
      </button>
    </div>
  );
}
