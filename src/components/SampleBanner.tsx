interface Props {
  onRemove: () => void;
}

export function SampleBanner({ onRemove }: Props) {
  return (
    <div className="sample-banner" role="status">
      <div>
        <strong>Exemples chargés</strong>
        Quelques jours pour découvrir Sillage. Tu peux les retirer quand tu veux.
      </div>
      <button type="button" onClick={onRemove}>
        Retirer
      </button>
    </div>
  );
}
