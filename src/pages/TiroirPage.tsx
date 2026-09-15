import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { JournalApi } from '../hooks/useJournal';

interface Props {
  journal: JournalApi;
}

type Section = 'main' | 'epingles' | 'prive' | 'reglages' | 'apropos';

export function TiroirPage({ journal }: Props) {
  const [section, setSection] = useState<Section>('main');

  if (section === 'epingles') {
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={() => setSection('main')} style={{ marginBottom: 14 }}>
          ← Retour
        </button>
        <h1 className="page-title">Épinglés</h1>
        <p className="page-sub">Photos marquées d&apos;une épingle</p>
        {journal.pinnedPhotos.length === 0 ? (
          <p className="muted">Rien d&apos;épinglé pour l&apos;instant.</p>
        ) : (
          <div className="pinned-mini">
            {journal.pinnedPhotos.map(({ day, photo }) => (
              <Link key={photo.id} to={`/jour/${day.id}`}>
                <img src={photo.url} alt={day.title || 'Photo'} loading="lazy" />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (section === 'prive') {
    return (
      <div>
        <button type="button" className="btn-ghost" onClick={() => setSection('main')} style={{ marginBottom: 14 }}>
          ← Retour
        </button>
        <h1 className="page-title">Privé</h1>
        <p className="page-sub">Jours marqués comme privés</p>
        {journal.privateDays.length === 0 ? (
          <p className="muted">Aucun jour privé.</p>
        ) : (
          journal.privateDays.map((d) => (
            <Link key={d.id} to={`/jour/${d.id}`} className="search-result">
              <div className="t">{d.title.trim() || 'Sans titre'}</div>
              <div className="m">{d.id}</div>
            </Link>
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
      <div>
        <button type="button" className="btn-ghost" onClick={() => setSection('main')} style={{ marginBottom: 14 }}>
          ← Retour
        </button>
        <h1 className="page-title">Réglages</h1>
        <div className="drawer-card">
          <button type="button" className="drawer-row" onClick={() => journal.removeSamples()}>
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
            <button type="button" className="drawer-row" onClick={() => journal.restoreSamples()}>
              <div className="left">
                Restaurer les exemples
                <span>Réintroduire les trois jours démo</span>
              </div>
            </button>
          ) : null}
          <div className="drawer-row">
            <div className="left">
              Langue
              <span>Français</span>
            </div>
          </div>
          <button type="button" className="drawer-row" onClick={() => setSection('apropos')}>
            <div className="left">
              À propos Sillage
              <span>Journal intime</span>
            </div>
            <span className="chev">›</span>
          </button>
          <div className="drawer-row">
            <div className="left">
              Export
              <span>Bientôt</span>
            </div>
          </div>
        </div>
      </div>
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
              <span>{journal.pinnedPhotos.length} photo(s)</span>
            </div>
            <span className="chev">›</span>
          </button>
          <button type="button" className="drawer-row" onClick={() => setSection('prive')}>
            <div className="left">
              Privé
              <span>{journal.privateDays.length} jour(s)</span>
            </div>
            <span className="chev">›</span>
          </button>
          <button type="button" className="drawer-row" onClick={() => setSection('reglages')}>
            <div className="left">
              Réglages
              <span>Exemples, langue, à propos</span>
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
