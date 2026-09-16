import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MOODS, addNormalizedTag, normalizeTags } from '../types';
import {
  formatDateLong,
  hasContent,
  type JournalApi,
} from '../hooks/useJournal';
import { rememberPlace, reverseGeocode } from '../lib/geocode';
import { LieuField } from '../components/LieuField';
import { CoffreUnlock } from '../components/CoffreUnlock';
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
    !!(day.location || day.mood || day.photos.length || (day.tags && day.tags.length)),
  );
  const [tagDraft, setTagDraft] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [savePhase, setSavePhase] = useState<SavePhase>('idle');
  const [geoSupported] = useState(
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
  );
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoSessionRef = useRef<{
    cancelled: boolean;
    abort: AbortController;
  } | null>(null);

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
        tags: day.tags ?? [],
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
      day.tags,
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
      const session = geoSessionRef.current;
      if (session) {
        session.cancelled = true;
        session.abort.abort();
        geoSessionRef.current = null;
      }
    };
  }, []);

  const tags = useMemo(() => normalizeTags(day.tags), [day.tags]);

  const metaSummary = useMemo(() => {
    const parts: string[] = [];
    if (day.mood) {
      const m = MOODS.find((x) => x.id === day.mood);
      if (m) parts.push(`${m.icon} ${m.label}`);
    }
    if (day.location.trim()) parts.push(day.location.trim());
    if (tags.length) {
      parts.push(
        tags.length === 1 ? tags[0] : `${tags.length} étiquettes`,
      );
    }
    if (day.photos.length) {
      const n = day.photos.length;
      parts.push(`${n} photo${n > 1 ? 's' : ''}`);
    }
    return parts.length ? parts.join(' · ') : 'Lieu, humeur, étiquettes…';
  }, [day.mood, day.location, day.photos.length, tags]);

  const commitTag = () => {
    const next = addNormalizedTag(tags, tagDraft);
    if (next.length === tags.length && !tagDraft.trim()) {
      setTagDraft('');
      return;
    }
    if (next.length === tags.length) {
      setTagDraft('');
      return;
    }
    journal.updateDay(id, { tags: next });
    setTagDraft('');
    setMetaOpen(true);
  };

  const removeTag = (tag: string) => {
    const key = tag.toLocaleLowerCase('fr');
    journal.updateDay(id, {
      tags: tags.filter((t) => t.toLocaleLowerCase('fr') !== key),
    });
  };

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

  const cancelGeo = () => {
    const session = geoSessionRef.current;
    if (session) {
      session.cancelled = true;
      session.abort.abort();
      geoSessionRef.current = null;
    }
    setGeoBusy(false);
  };

  const locateMe = () => {
    setGeoError(null);
    if (!('geolocation' in navigator)) {
      setGeoError('Géolocalisation indisponible');
      return;
    }

    cancelGeo();
    const abort = new AbortController();
    const session = { cancelled: false, abort };
    geoSessionRef.current = session;
    setGeoBusy(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void (async () => {
          if (session.cancelled) return;
          try {
            const outcome = await reverseGeocode(
              pos.coords.latitude,
              pos.coords.longitude,
              abort.signal,
            );
            if (session.cancelled) return;
            if (outcome.status === 'ok') {
              // Seed recent + cache with device coords so Lieu search can soft-bias nearby
              rememberPlace(outcome.label, {
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
              });
              journal.updateDay(id, { location: outcome.label });
              setGeoError(null);
            } else if (outcome.status === 'miss') {
              setGeoError('Introuvable');
            } else {
              setGeoError('Pas de réseau');
            }
          } catch {
            if (!session.cancelled) setGeoError('Pas de réseau');
          } finally {
            if (!session.cancelled) {
              setGeoBusy(false);
              if (geoSessionRef.current === session) geoSessionRef.current = null;
            }
          }
        })();
      },
      (err) => {
        if (session.cancelled) return;
        setGeoBusy(false);
        if (geoSessionRef.current === session) geoSessionRef.current = null;
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Position refusée');
        } else if (err.code === err.TIMEOUT) {
          setGeoError('Introuvable');
        } else {
          setGeoError('Introuvable');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60_000,
      },
    );
  };

  const needsCoffreUnlock =
    day.private && journal.hasCoffrePin && !journal.coffreUnlocked;

  if (needsCoffreUnlock) {
    return (
      <CoffreUnlock
        onUnlock={journal.unlockCoffre}
        onBack={() => navigate(backTo)}
      />
    );
  }

  return (
    <div className="day-page">
      <header className="day-header">
        <Link to={backTo} className="back-btn" aria-label="Retour">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="badge">{badgeLabel}</span>
        <span
          className={`save-status${savePhase === 'idle' ? ' is-idle' : ''}${savePhase === 'saved' ? ' is-saved' : ''}`}
          aria-live="polite"
        >
          {savePhase === 'saving'
            ? 'Enregistrement…'
            : savePhase === 'saved'
              ? 'Enregistré'
              : ''}
        </span>
      </header>

      <section className="day-write" aria-label="Écrire le souvenir">
        <p className="day-date">{formatDateLong(id)}</p>

        <input
          className="title-input"
          type="text"
          placeholder="Un titre, même court…"
          value={day.title}
          onChange={(e) => journal.updateDay(id, { title: e.target.value })}
          aria-label="Titre"
        />

        <div className="story-label">Le souvenir</div>
        <textarea
          className="story-input"
          placeholder="Qu’est-ce qui restera de cette journée ?"
          value={day.story}
          onChange={(e) => journal.updateDay(id, { story: e.target.value })}
          onBlur={onStoryBlur}
          aria-label="Souvenir"
        />
      </section>

      <section className="day-meta" aria-label="Détails du jour">
        <button
          type="button"
          className="meta-toggle"
          onClick={() => setMetaOpen((o) => !o)}
          aria-expanded={metaOpen}
        >
          <span className="meta-toggle-text">{metaSummary}</span>
          <span className="meta-toggle-chev" aria-hidden="true">
            {metaOpen ? '▴' : '▾'}
          </span>
        </button>

        {metaOpen ? (
          <div className="meta-panel">
            <div className="meta-block">
              <div className="field-label">Lieu</div>
              <div className="lieu-row">
                <LieuField
                  value={day.location}
                  onChange={(location) => {
                    setGeoError(null);
                    journal.updateDay(id, { location });
                  }}
                />
                {geoSupported ? (
                  geoBusy ? (
                    <button
                      type="button"
                      className="btn-ghost lieu-gps-btn"
                      onClick={cancelGeo}
                    >
                      Annuler
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ghost lieu-gps-btn"
                      onClick={locateMe}
                      title="Remplir le lieu depuis la position de l’appareil"
                    >
                      Ma position
                    </button>
                  )
                ) : null}
              </div>
              {geoBusy ? (
                <p className="muted lieu-gps-status" aria-live="polite">
                  Localisation…
                </p>
              ) : null}
              {geoError && !geoBusy ? (
                <p className="muted lieu-gps-status" role="alert">
                  {geoError}
                </p>
              ) : null}
            </div>

            <div className="meta-block">
              <div className="field-label">Humeur</div>
              <div className="mood-chips">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`mood-chip${day.mood === m.id ? ' active' : ''}`}
                    aria-pressed={day.mood === m.id}
                    onClick={() =>
                      journal.setMood(id, day.mood === m.id ? null : m.id)
                    }
                  >
                    <span aria-hidden="true">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="meta-block">
              <div className="field-label">Étiquettes</div>
              <div className="tag-editor" role="group" aria-label="Étiquettes du jour">
                {tags.map((tag) => (
                  <button
                    key={tag.toLocaleLowerCase('fr')}
                    type="button"
                    className="tag-chip"
                    onClick={() => removeTag(tag)}
                    aria-label={`Retirer l’étiquette ${tag}`}
                    title="Retirer"
                  >
                    <span>{tag}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                <input
                  className="tag-input"
                  type="text"
                  placeholder="Ajouter…"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitTag();
                    }
                  }}
                  onBlur={() => {
                    if (tagDraft.trim()) commitTag();
                  }}
                  aria-label="Ajouter une étiquette"
                  enterKeyHint="done"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
              <p className="tag-hint muted">
                Entrée pour ajouter · toucher une étiquette pour la retirer
              </p>
            </div>

            <div className="meta-block">
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
                        aria-pressed={!!p.pinned}
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
                  <span className="add-photo-icon" aria-hidden="true">
                    ＋
                  </span>
                  <span className="add-photo-label">
                    {photoBusy ? 'Ajout…' : 'Ajouter'}
                  </span>
                </button>
              </div>

              {photoError ? (
                <p className="photo-error muted" role="alert">
                  {photoError}
                </p>
              ) : null}
            </div>

            <div className="day-actions" role="group" aria-label="Actions du jour">
              <button
                type="button"
                className={`btn-ghost day-action-btn${day.pinned ? ' is-on' : ''}`}
                onClick={() => journal.updateDay(id, { pinned: !day.pinned })}
                aria-pressed={!!day.pinned}
              >
                {day.pinned ? 'Désépingler le jour' : 'Épingler le jour'}
              </button>
              <button
                type="button"
                className={`btn-ghost day-action-btn${day.private ? ' is-on' : ''}`}
                onClick={() => journal.updateDay(id, { private: !day.private })}
                aria-pressed={!!day.private}
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
      </section>

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
