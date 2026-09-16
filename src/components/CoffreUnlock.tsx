import { useState, type FormEvent } from 'react';

interface Props {
  onUnlock: (pin: string) => Promise<boolean>;
  onBack?: () => void;
  title?: string;
}

export function CoffreUnlock({
  onUnlock,
  onBack,
  title = 'Coffre',
}: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const ok = await onUnlock(pin);
      if (!ok) {
        setError('Code incorrect.');
        setPin('');
      }
    } catch {
      setError('Code incorrect.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="coffre-unlock">
      {onBack ? (
        <button
          type="button"
          className="btn-ghost"
          onClick={onBack}
          style={{ marginBottom: 14 }}
        >
          ← Retour
        </button>
      ) : null}
      <h1 className="page-title">{title}</h1>
      <p className="coffre-unlock-serif">Entre ton code pour ouvrir.</p>
      <form className="coffre-unlock-form" onSubmit={(e) => void handleSubmit(e)}>
        <input
          className="coffre-pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            setError(null);
            setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
          }}
          aria-label="Code du coffre"
          disabled={busy}
          autoFocus
        />
        {error ? (
          <p className="muted coffre-unlock-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || pin.length < 4}
          style={{ marginTop: 16, width: '100%' }}
        >
          {busy ? '…' : 'Ouvrir'}
        </button>
      </form>
    </div>
  );
}
