interface Props {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ onUpdate, onDismiss }: Props) {
  return (
    <div className="sw-update-wrap">
      <div className="sw-update-banner" role="status">
        <div>
          <strong>Nouvelle version</strong>
          Une mise à jour est prête, sans rien perdre.
        </div>
        <div className="sw-update-banner-actions">
          <button
            type="button"
            className="sw-update-banner-apply"
            onClick={onUpdate}
          >
            Mettre à jour
          </button>
          <button
            type="button"
            className="sw-update-banner-dismiss"
            onClick={onDismiss}
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
