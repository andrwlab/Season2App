import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom';

// Páginas principales
import ProtectedRoute from './ProtectedRoute';
import Navbar from './Navbar';
import Home from './pages/Home';

const Admin = lazy(() => import('./pages/Admin'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Matches = lazy(() => import('./pages/Matches'));
const Players = lazy(() => import('./pages/Players'));
const Teams = lazy(() => import('./pages/Teams'));
const Schedule = lazy(() => import('./pages/Schedule'));
const MatchDetail = lazy(() => import('./pages/MatchDetail'));
const AdminMatch = lazy(() => import('./pages/AdminMatch'));
const TeamDetail = lazy(() => import('./pages/TeamDetail'));
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'));
const AdminRosters = lazy(() => import('./pages/AdminRosters'));
const CumulativeStats = lazy(() => import('./pages/CumulativeStats'));

// Pilot/admin surfaces stay in the main bundle so navigation remains reliable
// during long scorer sessions and GitHub Pages deployments.
import PilotScorerSurface from './pages/PilotScorerSurface';
import PilotLive from './pages/PilotLive';
import PilotTournament from './pages/PilotTournament';
import PilotSetup from './pages/PilotSetup';
import PilotAdminHome from './pages/PilotAdminHome';

const LegacyScorerRedirect = () => {
  const { tournamentId = '', matchId = '' } = useParams();
  return <Navigate to={`/pilot/${tournamentId}/match/${matchId}`} replace />;
};

const LegacySetupRedirect = () => {
  const { tournamentId = '' } = useParams();
  return <Navigate to={`/pilot/${tournamentId}`} replace />;
};

function AppShell() {
  const location = useLocation();
  const isPilotSurface = location.pathname.startsWith('/scorer/') || location.pathname.startsWith('/live/') || location.pathname.startsWith('/pilot');

  return (
    <>
      {!isPilotSurface && <Navbar />}
      <Suspense fallback={<div className="p-6 text-muted">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/players" element={<Players />} />
          <Route path="/cumulative" element={<CumulativeStats />} />
          <Route path="/players/:id" element={<PlayerProfile />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/admin-match/:id" element={<AdminMatch />} />
          <Route path="/admin/rosters" element={<AdminRosters />} />

          {/* Public spectator flow */}
          <Route path="/live/:tournamentId" element={<PilotTournament />} />
          <Route path="/live/:tournamentId/match/:matchId" element={<PilotLive />} />

          {/* Single admin namespace: /pilot */}
          <Route path="/pilot" element={<PilotAdminHome />} />
          <Route path="/pilot/:tournamentId" element={<PilotSetup />} />
          <Route path="/pilot/:tournamentId/match/:matchId" element={<PilotScorerSurface />} />

          {/* Legacy links remain valid and immediately resolve to the clean URLs. */}
          <Route path="/pilot/:tournamentId/setup" element={<LegacySetupRedirect />} />
          <Route path="/scorer/:tournamentId/:matchId" element={<LegacyScorerRedirect />} />

          <Route
            path="/matches"
            element={
              <ProtectedRoute requiredRole="admin">
                <Matches />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <Admin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  const baseName =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/Season2App')
      ? '/Season2App'
      : '/';
  return (
    <Router basename={baseName}>
      <AppShell />
    </Router>
  );
}

export default App;
