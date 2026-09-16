import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MOODS } from '../types';
import {
  formatDateLong,
  hasContent,
  type JournalApi,
} from '../hooks/useJournal';
import { PhotoCaptureSheet } from '../components/PhotoCaptureSheet';

interface Props {
  journal: JournalApi;
}

type SavePhase = 'idle' | 'saving' | 'saved';

function titleFromStory(story: string, max = 56): string {
  const firstLine = story.split(/\r?\n/)[0] ?? '';
  const collapsed = firstLine.trim().replace(/\s+/g, ' ');
  if (!collapsed) return '';
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
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
  const [captureOpen, setCaptureOpen] = useState(false);
  const [savePhase, setSavePhase] = useState<SavePhase>('idle');

  const skipFirstSave = useRef(true);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSig = useMemo(
    () =>
      JSON.stringify({
        title: day.title,
        story: day.story,
        location: day.location,
        mood: day.mood,
        photos: day.photos.map((p) => `${p.id}:${p.pinned ? 1 : 0}`),
        private: day.private,
        pinned: day.pinned,
        updatedAt: day.updatedAt,
      }),
    [
      day.title,
      day.story,
      day.location,
      day.mood,
      day.photos,
      day.private,
      day.pinned,
      day.updatedAt,
    ],
  );

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    if (savedFadeRef.current) clearTimeout(savedFadeRef.current);

    saveDebounceRef.current = setTimeout(() => {
      setSavePhase('saving');
      // Data already persisted by useJournal; brief "saving" then "saved"
      savedFadeRef.current = setTimeout(() => {
        setSavePhase('saved');
        savedFadeRef.current = setTimeout(() => {
          setSavePhase('idle');
        }, 1800);
      }, 280);
    }, 400);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [saveSig]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    };
  }, []);

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

  const badgeLabel = day.private
    ? 'Coffre'
    : isToday
      ? "Aujourd'hui"
      : 'Souvenir';

  const backTo = day.private ? '/tiroir' : '/';

  const handleDelete = () => {
    if (!hasContent(day)) {
      navigate(backTo);
      return;
    }
    if (window.confirm('Effacer cette journée ?')) {
      journal.deleteDay(id);
      navigate(backTo);
    }
  };

  const openCapture = () => {
    setPhotoError(null);
    setCaptureOpen(true);
  };

  const onPhotosFromSheet = async (dataUrls: string[]) => {
    if (!dataUrls.length) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      for (const dataUrl of dataUrls) {
        await journal.addPhoto(id, dataUrl);
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
    }
  };

  const onStoryBlur = () => {
    if (day.title.trim()) return;
    if (!day.story.trim()) return;
    const auto = titleFromStory(day.story);
    if (auto) journal.updateDay(id, { title: auto });
  };

  return (
    <div>
      <div className="day-header">
        <Link to={backTo} className="back-btn" aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="badge">{badgeLabel}</span>
        <span
          className={`save-status${savePhase === 'idle' ? ' is-idle' : ''}`}
          aria-live="polite"
        >
          {savePhase === 'saving'
            ? 'Enregistrement…'
            : savePhase === 'saved'
              ? 'Enregistré'
              : ''}
        </span>
      </div>

      <p className="day-date">{formatDateLong(id)}</p>

      <input
        className="title-input"
        type="text"
        placeholder="Un titre, même court…"
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
        onBlur={onStoryBlur}
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
              onClick={openCapture}
              disabled={photoBusy}
            >
              <span aria-hidden="true">＋</span>
              {photoBusy ? 'Ajout…' : 'Ajouter'}
            </button>
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
              {day.private ? 'Sortir du coffre' : 'Mettre au coffre'}
            </button>
          </div>
          {day.private ? (
            <p className="muted coffre-hint">
              Invisible dans le Fil, l&apos;Album et la recherche.
            </p>
          ) : null}
        </div>
      ) : null}

      <button type="button" className="btn-danger" onClick={handleDelete}>
        Effacer cette journée
      </button>

      <PhotoCaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onPhotos={(urls) => void onPhotosFromSheet(urls)}
        busy={photoBusy}
      />
    </div>
  );
}
