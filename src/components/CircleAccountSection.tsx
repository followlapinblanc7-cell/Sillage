import { useAuthSession } from '../hooks/useAuthSession';
import { useCircles } from '../hooks/useCircles';

/**
 * Tiroir « Compte / Cercle » — optional cloud layer.
 * Without VITE_SUPABASE_* : calm FR copy that cloud isn’t configured.
 * With env : Google sign-in + placeholder circle list.
 */
export function CircleAccountSection() {
  const auth = useAuthSession();
  const { circles, loading: circlesLoading, error: circlesError } = useCircles(
    auth.user?.id,
  );

  if (!auth.configured) {
    return (
      <div className="drawer-section cercle-section">
        <h2 className="drawer-section-title">Compte / Cercle</h2>
        <div className="drawer-card cercle-card">
          <p className="cercle-calm">
            Le journal reste ici, sur cet appareil. Le cercle privé — pour
            partager un jour avec quelques proches — n’est pas encore branché
            sur ce build.
          </p>
          <p className="muted cercle-calm-sub">
            Quand le cloud sera configuré, tu pourras te connecter avec Google
            et inviter 2 à 5 personnes. Le coffre ne part jamais.
          </p>
        </div>
      </div>
    );
  }

  if (auth.loading) {
    return (
      <div className="drawer-section cercle-section">
        <h2 className="drawer-section-title">Compte / Cercle</h2>
        <div className="drawer-card">
          <p className="muted" style={{ margin: '14px 16px' }}>
            Connexion…
          </p>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="drawer-section cercle-section">
        <h2 className="drawer-section-title">Compte / Cercle</h2>
        <div className="drawer-card cercle-card">
          <p className="cercle-calm">
            Optionnel. Tes jours restent locaux ; le cercle sert seulement à
            partager un souvenir choisi dans « Ensemble ».
          </p>
          <div className="cercle-actions">
            <button
              type="button"
              className="btn-primary cercle-google-btn"
              onClick={() => void auth.signInWithGoogle()}
            >
              Se connecter avec Google
            </button>
          </div>
          <p className="muted cercle-calm-sub">
            Apple arrivera plus tard. Réseau requis pour le cercle ; le journal
            fonctionne hors ligne.
          </p>
        </div>
      </div>
    );
  }

  const label =
    auth.user.user_metadata?.full_name ||
    auth.user.user_metadata?.name ||
    auth.user.email ||
    'Compte';

  return (
    <div className="drawer-section cercle-section">
      <h2 className="drawer-section-title">Compte / Cercle</h2>
      <div className="drawer-card">
        <div className="drawer-row cercle-account-row">
          <div className="left">
            {label}
            <span>Connecté · Google</span>
          </div>
          <button
            type="button"
            className="btn-ghost cercle-signout"
            onClick={() => void auth.signOut()}
          >
            Sortir
          </button>
        </div>

        <div className="cercle-list-block">
          <p className="cercle-list-heading">Tes cercles</p>
          {circlesLoading ? (
            <p className="muted cercle-list-empty">Chargement…</p>
          ) : circlesError ? (
            <p className="muted cercle-list-empty" role="alert">
              {circlesError}
            </p>
          ) : circles.length === 0 ? (
            <p className="muted cercle-list-empty">
              Pas encore de cercle. La création et l’invitation par lien
              arriveront bientôt (2 à 5 membres).
            </p>
          ) : (
            <ul className="cercle-list">
              {circles.map((c) => (
                <li key={c.id} className="cercle-list-item">
                  <span className="cercle-list-name">{c.name}</span>
                  <span className="muted">
                    {c.memberCount} · {c.role === 'owner' ? 'hôte' : 'membre'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
