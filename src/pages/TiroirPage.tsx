import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { DayCard } from '../components/DayCard';
import type { JournalApi } from '../hooks/useJournal';
import {
  downloadReadableExport,
  parseBackupFile,
} from '../lib/exportJournal';

interface Props {
  journal: JournalApi;
}

type Section = 'main' | 'epingles' | 'coffre' | 'reglages' | 'apropos';

const HOUR_OPTIONS = [20, 21, 22] as const;

function hourLabel(h: number): string {
  return `${h} h`;
}


function ReglagesSection({
  journal,
  onApropos,
  onBack,
}: {
  journal: JournalApi;
  onApropos: () => void;
  onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reminderOn = journal.eveningReminder;
  const hour = journal.eveningHour;

  const handleExportBackup = () => {
    setError(null);
    try {
      journal.exportBackup();
    } catch {
      setError('Impossible d’exporter la sauvegarde.');
    }
  };

  const handleImportClick = () => {
    setError(null);
    fileRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const next = await parseBackupFile(file);
      const ok = window.confirm(
        'Remplacer tout le journal local par cette sauvegarde ?',
      );
      if (ok) {
        journal.importBackup(next);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Impossible d’importer ce fichier.';
      setError(msg);
      window.alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleReadableExport = () => {
    setError(null);
    setBusy(true);
    try {
      downloadReadableExport(journal.state);
    } catch {
      setError('Impossible de générer l’export lisible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn-ghost" onClick={onBack} style={{ marginBottom: 14 }}>
        ← Retour
      </button>
      <h1 className="page-title">Réglages</h1>
      <div className="drawer-card">
        <button
          type="button"
          className="drawer-row"
          onClick={() => journal.removeSamples()}
          disabled={busy}
        >
          <div className="left">
            Retirer les exemples
            <span>
              {journal.samplesPresent
                ? 'Supprimer les jours d’exemple'
                : 'Aucun exemple présent'}
            </span>
          </div>
        </button>
        {!journal.samplesPresent ? (
          <button
            type="button"
            className="drawer-row"
            onClick={() => journal.restoreSamples()}
            disabled={busy}
          >
            <div className="left">
              Restaurer les exemples
              <span>Réintroduire les trois jours démo</span>
            </div>
          </button>
        ) : null}

        <div className="drawer-row">
          <div className="left">
            Rappel du soir
            <span>Si tu n&apos;as pas écrit, un geste discret.</span>
          </div>
          <button
            type="button"
            className={`toggle${reminderOn ? ' on' : ''}`}
            role="switch"
            aria-checked={reminderOn}
            aria-label="Rappel du soir"
            onClick={() => journal.setEveningReminder(!reminderOn)}
            disabled={busy}
          >
            <span className="toggle-knob" />
          </button>
        </div>
        {reminderOn ? (
          <div className="drawer-row evening-hour-row">
            <div className="left">
              Heure
              <span>Sur cet appareil seulement</span>
            </div>
            <div className="hour-chips" role="group" aria-label="Heure du rappel">
              {HOUR_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`hour-chip${hour === h ? ' active' : ''}`}
                  onClick={() => journal.setEveningHour(h)}
                  disabled={busy}
                >
                  {hourLabel(h)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="drawer-row"
          onClick={handleExportBackup}
          disabled={busy}
        >
          <div className="left">
            Exporter la sauvegarde
            <span>JSON complet, avec le coffre</span>
          </div>
        </button>
        <button
          type="button"
          className="drawer-row"
          onClick={handleImportClick}
          disabled={busy}
        >
          <div className="left">
            Importer une sauvegarde
            <span>Remplace le journal sur cet appareil</span>
          </div>
        </button>
        <button
          type="button"
          className="drawer-row"
          onClick={handleReadableExport}
          disabled={busy}
        >
          <div className="left">
            Exporter en lecture
            <span>
              {busy
                ? 'Génération en cours…'
                : 'HTML à ouvrir ou imprimer en PDF'}
            </span>
          </div>
        </button>
        {error ? (
          <p className="muted" style={{ margin: '8px 14px 12px', fontSize: '0.85rem' }}>
            {error}
          </p>
        ) : null}

        <div className="drawer-row">
          <div className="left">
            Langue
            <span>Français</span>
          </div>
        </div>
        <button type="button" className="drawer-row" onClick={onApropos} disabled={busy}>
          <div className="left">
            À propos Sillage
            <span>Journal intime</span>
          </div>
          <span className="chev">›</span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
}

export function TiroirPage({ journal }: Props) {
  const [section, setSection] = useState<Section>('main');

  if (section === 'epingles') {
    const hasPinned =
      journal.pinnedPhotos.length > 0 || journal.pinnedDays.length > 0;
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={() => setSection('main')} style={{ marginBottom: 14 }}>
          ← Retour
        </button>
        <h1 className="page-title">Épinglés</h1>
        <p className="page-sub">Photos et jours mis en avant</p>
        {!hasPinned ? (
          <p className="muted">Rien d&apos;épinglé pour l&apos;instant.</p>
        ) : (
          <>
            {journal.pinnedPhotos.length > 0 ? (
              <div className="pinned-mini">
                {journal.pinnedPhotos.map(({ day, photo }) => (
                  <Link key={photo.id} to={`/jour/${day.id}`}>
                    <img src={photo.url} alt={day.title || 'Photo'} loading="lazy" />
                  </Link>
                ))}
              </div>
            ) : null}
            {journal.pinnedDays.length > 0 ? (
              <div style={{ marginTop: journal.pinnedPhotos.length > 0 ? 18 : 0 }}>
                {journal.pinnedDays.map((d) => (
                  <DayCard key={d.id} day={d} showDate />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (section === 'coffre') {
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={() => setSection('main')} style={{ marginBottom: 14 }}>
          ← Retour
        </button>
        <h1 className="page-title">Coffre</h1>
        <p className="page-sub">Jours visibles seulement ici.</p>
        {journal.privateDays.length === 0 ? (
          <div className="empty-state">
            <p className="empty-quote">
              « Ce que tu ranges ici n&apos;apparaît nulle part ailleurs. »
            </p>
            <p className="muted" style={{ marginTop: 0 }}>
              Depuis un jour, mets-le au coffre.
            </p>
          </div>
        ) : (
          journal.privateDays.map((d) => (
            <DayCard key={d.id} day={d} showDate />
          ))
        )}
      </div>
    );
  }

  if (section === 'apropos') {
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={() => setSection('reglages')} style={{ marginBottom: 14 }}>
          ← Retour
        </button>
        <h1 className="page-title">À propos</h1>
        <div className="drawer-card about-box">
          <strong style={{ color: 'var(--cream)', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '1.2rem' }}>
            Sillage
          </strong>
          <p style={{ marginTop: 8 }}>
            Un journal intime, simple et discret. Tes jours restent sur cet appareil —
            rien n&apos;est envoyé ailleurs.
          </p>
        </div>
      </div>
    );
  }

  if (section === 'reglages') {
    return (
      <ReglagesSection journal={journal} onApropos={() => setSection('apropos')} onBack={() => setSection('main')} />
    );
  }

  return (
    <div>
      <h1 className="page-title">Tiroir</h1>
      <p className="page-sub">Ce que tu mets de côté</p>

      <div className="drawer-section">
        <div className="drawer-card">
          <button type="button" className="drawer-row" onClick={() => setSection('epingles')}>
            <div className="left">
              Épinglés
              <span>Photos et jours mis en avant</span>
            </div>
            <span className="chev">›</span>
          </button>
          <button type="button" className="drawer-row" onClick={() => setSection('coffre')}>
            <div className="left">
              Coffre
              <span>Jours visibles seulement ici · {journal.privateDays.length}</span>
            </div>
            <span className="chev">›</span>
          </button>
          <button type="button" className="drawer-row" onClick={() => setSection('reglages')}>
            <div className="left">
              Réglages
              <span>Données, exemples, à propos</span>
            </div>
            <span className="chev">›</span>
          </button>
        </div>
      </div>

      {journal.showSamplesBanner ? (
        <button type="button" className="btn-ghost" onClick={() => journal.removeSamples()}>
          Retirer les exemples
        </button>
      ) : null}
    </div>
  );
}
