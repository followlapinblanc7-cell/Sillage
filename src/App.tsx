import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { useJournal } from './hooks/useJournal';
import { AlbumPage } from './pages/AlbumPage';
import { ChercherPage } from './pages/ChercherPage';
import { DayPage } from './pages/DayPage';
import { FilPage } from './pages/FilPage';
import { TiroirPage } from './pages/TiroirPage';

function DayRoute({ journal }: { journal: ReturnType<typeof useJournal> }) {
  const { id } = useParams();
  return <DayPage key={id} journal={journal} />;
}

function AppRoutes() {
  const journal = useJournal();

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<FilPage journal={journal} />} />
          <Route path="/album" element={<AlbumPage journal={journal} />} />
          <Route path="/chercher" element={<ChercherPage journal={journal} />} />
          <Route path="/tiroir" element={<TiroirPage journal={journal} />} />
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
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
