import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

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
const PilotScorerSurface = lazy(() => import('./pages/PilotScorerSurface'));
const PilotLive = lazy(() => import('./pages/PilotLive'));
const PilotTournament = lazy(() => import('./pages/PilotTournament'));
const PilotSetup = lazy(() => import('./pages/PilotSetup'));
const PilotAdminHome = lazy(() => import('./pages/PilotAdminHome'));

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

          <Route path="/scorer/:tournamentId/:matchId" element={<PilotScorerSurface />} />
          <Route path="/live/:tournamentId" element={<PilotTournament />} />
          <Route path="/live/:tournamentId/match/:matchId" element={<PilotLive />} />
          <Route path="/pilot" element={<PilotAdminHome />} />
          <Route path="/pilot/:tournamentId/setup" element={<PilotSetup />} />

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
