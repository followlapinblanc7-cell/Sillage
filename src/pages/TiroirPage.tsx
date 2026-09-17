import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CoffreUnlock } from '../components/CoffreUnlock';
import { DayCard } from '../components/DayCard';
import { MoisGlimpse } from '../components/MoisGlimpse';
import type { JournalApi } from '../hooks/useJournal';
import {
  downloadReadableExport,
  parseBackupFile,
} from '../lib/exportJournal';
import type { ThemeId } from '../lib/theme';

interface Props {
  journal: JournalApi;
}

type Section = 'main' | 'epingles' | 'coffre' | 'reglages' | 'apropos';
type PinFormMode = null | 'set' | 'change' | 'clear';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __sillageInstallPrompt?: Event | null;
  }
}

const HOUR_OPTIONS = [20, 21, 22] as const;

function hourLabel(h: number): string {
  return `${h} h`;
}

function PinDigitsInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      className="coffre-pin-input"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      aria-label={label}
      placeholder={label}
      disabled={disabled}
    />
  );
}

function CoffrePinSettings({ journal }: { journal: JournalApi }) {
  const [mode, setMode] = useState<PinFormMode>(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setPin('');
    setConfirm('');
    setCurrent('');
    setError(null);
    setMode(null);
  };

  const openMode = (m: PinFormMode) => {
    setPin('');
    setConfirm('');
    setCurrent('');
    setError(null);
    setMode(m);
  };

  const handleSet = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin.length < 4 || pin.length > 6) {
      setError('4 à 6 chiffres');
      return;
    }
    if (pin !== confirm) {
      setError('Les codes ne correspondent pas');
      return;
    }
    setBusy(true);
    try {
      await journal.setCoffrePin(pin);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer.');
    } finally {
      setBusy(false);
    }
  };

  const handleChange = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin.length < 4 || pin.length > 6) {
      setError('4 à 6 chiffres');
      return;
    }
    if (pin !== confirm) {
      setError('Les codes ne correspondent pas');
      return;
    }
    setBusy(true);
    try {
      await journal.changeCoffrePin(current, pin);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de modifier.');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await journal.clearCoffrePin(current);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de retirer.');
    } finally {
      setBusy(false);
    }
  };

  if (!journal.hasCoffrePin) {
    return (
      <>
        {mode !== 'set' ? (
          <button
            type="button"
            className="drawer-row"
            onClick={() => openMode('set')}
            disabled={busy}
          >
            <div className="left">
              Code du coffre
              <span>Protéger les jours privés</span>
            </div>
            <span className="chev">›</span>
          </button>
        ) : (
          <form className="coffre-pin-form" onSubmit={(e) => void handleSet(e)}>
            <p className="coffre-pin-form-title">Code du coffre</p>
            <PinDigitsInput
              value={pin}
              onChange={setPin}
              label="Code"
              disabled={busy}
            />
            <PinDigitsInput
              value={confirm}
              onChange={setConfirm}
              label="Confirmer"
              disabled={busy}
            />
            {error ? (
              <p className="muted coffre-unlock-error" role="alert">
                {error}
              </p>
            ) : null}
            <p className="muted coffre-pin-disclaimer">
              Sur cet appareil. Ça décourage un regard, ce n’est pas un
              coffre-fort.
            </p>
            <div className="coffre-pin-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={resetForm}
                disabled={busy}
              >
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={busy}>
                Enregistrer
              </button>
            </div>
          </form>
        )}
      </>
    );
  }

  return (
    <>
      <div className="drawer-row">
        <div className="left">
          Code du coffre
          <span>Activé</span>
        </div>
      </div>

      {mode === 'change' ? (
        <form className="coffre-pin-form" onSubmit={(e) => void handleChange(e)}>
          <p className="coffre-pin-form-title">Modifier le code</p>
          <PinDigitsInput
            value={current}
            onChange={setCurrent}
            label="Code actuel"
            disabled={busy}
          />
          <PinDigitsInput
            value={pin}
            onChange={setPin}
            label="Nouveau code"
            disabled={busy}
          />
          <PinDigitsInput
            value={confirm}
            onChange={setConfirm}
            label="Confirmer"
            disabled={busy}
          />
          {error ? (
            <p className="muted coffre-unlock-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="coffre-pin-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={resetForm}
              disabled={busy}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              Enregistrer
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="drawer-row"
          onClick={() => openMode('change')}
          disabled={busy}
        >
          <div className="left">
            Modifier le code
            <span>Changer le code du coffre</span>
          </div>
          <span className="chev">›</span>
        </button>
      )}

      {mode === 'clear' ? (
        <form className="coffre-pin-form" onSubmit={(e) => void handleClear(e)}>
          <p className="coffre-pin-form-title">Retirer le code</p>
          <PinDigitsInput
            value={current}
            onChange={setCurrent}
            label="Code actuel"
            disabled={busy}
          />
          {error ? (
            <p className="muted coffre-unlock-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="coffre-pin-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={resetForm}
              disabled={busy}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              Retirer
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="drawer-row"
          onClick={() => openMode('clear')}
          disabled={busy}
        >
          <div className="left">
            Retirer le code
            <span>Ne plus demander de code</span>
          </div>
          <span className="chev">›</span>
        </button>
      )}

      {journal.coffreUnlocked ? (
        <button
          type="button"
          className="drawer-row"
          onClick={() => journal.lockCoffre()}
          disabled={busy}
        >
          <div className="left">
            Verrouiller maintenant
            <span>Fermer le coffre pour cet onglet</span>
          </div>
        </button>
      ) : null}

      <p className="muted coffre-pin-disclaimer" style={{ margin: '8px 14px 12px' }}>
        Sur cet appareil. Ça décourage un regard, ce n’est pas un coffre-fort.
      </p>
    </>
  );
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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const readInstallPrompt = () => {
      const prompt = window.__sillageInstallPrompt;
      if (prompt) {
        setInstallPrompt(prompt as BeforeInstallPromptEvent);
      }
    };
    const onBip = (e: Event) => {
      e.preventDefault();
      window.__sillageInstallPrompt = e;
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstallAvailable = () => readInstallPrompt();

    readInstallPrompt();
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('sillage-install-available', onInstallAvailable);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('sillage-install-available', onInstallAvailable);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    window.__sillageInstallPrompt = null;
    setInstallPrompt(null);
  };

  const handleExportBackup = async () => {
    setError(null);
    setBusy(true);
    try {
      await journal.exportBackup();
    } catch {
      setError('Impossible d’exporter la sauvegarde.');
    } finally {
      setBusy(false);
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
        'Remplacer tous tes jours locaux par cette sauvegarde ?',
      );
      if (ok) {
        await journal.importBackup(next);
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

  const handleReadableExport = async () => {
    setError(null);
    setBusy(true);
    try {
      await downloadReadableExport(journal.state);
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
            <span>Si tu n&apos;as rien gardé, un geste discret.</span>
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

        <div className="drawer-row evening-hour-row">
          <div className="left">
            Apparence
            <span>Thème de l&apos;interface</span>
          </div>
          <div className="hour-chips" role="group" aria-label="Apparence">
            {(
              [
                { id: 'dark' as ThemeId, label: 'Sombre' },
                { id: 'light' as ThemeId, label: 'Clair' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`hour-chip${journal.theme === opt.id ? ' active' : ''}`}
                onClick={() => journal.setTheme(opt.id)}
                disabled={busy}
                aria-pressed={journal.theme === opt.id}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <CoffrePinSettings journal={journal} />

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
            <span>Remplace tes jours sur cet appareil</span>
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
            Sur l&apos;écran d&apos;accueil
            <span>
              {installPrompt
                ? 'Ajouter Sillage comme application sur cet appareil'
                : 'Android — tape l’icône ↓ à droite de l’adresse, ou ⋮ → Installer l’application. iPhone — Safari → Partager → Sur l’écran d’accueil.'}
            </span>
          </div>
          {installPrompt ? (
            <button
              type="button"
              className="btn-ghost pwa-install-btn"
              onClick={() => void handleInstallPwa()}
              disabled={busy}
            >
              Installer Sillage
            </button>
          ) : null}
        </div>
        <div className="drawer-row">
          <div className="left">
            Langue
            <span>Français</span>
          </div>
        </div>
        <button type="button" className="drawer-row" onClick={onApropos} disabled={busy}>
          <div className="left">
            À propos Sillage
            <span>Mémoire du quotidien</span>
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
    if (journal.hasCoffrePin && !journal.coffreUnlocked) {
      return (
        <CoffreUnlock
          onUnlock={journal.unlockCoffre}
          onBack={() => setSection('main')}
        />
      );
    }
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
            Un lieu pour garder les traces de chaque jour — pour qu&apos;elles ne
            s&apos;effacent pas. Tes jours restent sur cet appareil ; rien n&apos;est
            envoyé ailleurs.
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

      <MoisGlimpse visibleDays={journal.visibleDays} today={journal.today} />

      <div className="drawer-section">
        <div className="drawer-card">
          <button type="button" className="drawer-row" onClick={() => setSection('epingles')}>
            <div className="left">
              Épinglés
              <span>Photos et jours mis en avant</span>
            </div>
            <span className="chev">›</span>
          </button>
          <Link to="/lieux" className="drawer-row">
            <div className="left">
              Lieux
              <span>Des lieux gardés sur la carte</span>
            </div>
            <span className="chev">›</span>
          </Link>
          <Link to="/calendrier" className="drawer-row">
            <div className="left">
              Calendrier
              <span>Les jours écrits, mois par mois</span>
            </div>
            <span className="chev">›</span>
          </Link>
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
              <span>Apparence, données, à propos</span>
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
