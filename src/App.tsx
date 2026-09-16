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

function DayRoute({ journal }: { journal: ReturnType<typeof useJournal> }) {
  const { id } = useParams();
  return <DayPage key={id} journal={journal} />;
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
