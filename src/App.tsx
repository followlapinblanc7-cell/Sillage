import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { UpdateBanner } from './components/UpdateBanner';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { useJournal } from './hooks/useJournal';
import { AlbumPage } from './pages/AlbumPage';
import { ChercherPage } from './pages/ChercherPage';
import { DayPage } from './pages/DayPage';
import { FilPage } from './pages/FilPage';
import { LieuxPage } from './pages/LieuxPage';
import { TiroirPage } from './pages/TiroirPage';

const MondePage = lazy(() =>
  import('./pages/MondePage').then((m) => ({ default: m.MondePage })),
);

function DayRoute({ journal }: { journal: ReturnType<typeof useJournal> }) {
  const { id } = useParams();
  return <DayPage key={id} journal={journal} />;
}

function MondeRoute({ journal }: { journal: ReturnType<typeof useJournal> }) {
  return (
    <Suspense
      fallback={
        <div className="monde-page monde-page-boot" aria-busy="true">
          <p className="monde-boot-msg" role="status">
            Le globe s’éveille…
          </p>
        </div>
      }
    >
      <MondePage journal={journal} />
    </Suspense>
  );
}

function AppRoutes() {
  const journal = useJournal();
  const swUpdate = useServiceWorkerUpdate();

  return (
    <div className={`app-shell${swUpdate.updateAvailable ? ' has-update-banner' : ''}`}>
      {swUpdate.updateAvailable ? (
        <UpdateBanner onUpdate={swUpdate.applyUpdate} onDismiss={swUpdate.dismiss} />
      ) : null}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<FilPage journal={journal} />} />
          <Route path="/album" element={<AlbumPage journal={journal} />} />
          <Route path="/chercher" element={<ChercherPage journal={journal} />} />
          <Route path="/tiroir" element={<TiroirPage journal={journal} />} />
          <Route path="/lieux" element={<LieuxPage journal={journal} />} />
          <Route path="/monde" element={<MondeRoute journal={journal} />} />
          <Route path="/jour/:id" element={<DayRoute journal={journal} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/Sillage">
      <AppRoutes />
    </BrowserRouter>
  );
}
