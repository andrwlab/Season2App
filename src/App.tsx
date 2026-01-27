import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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

function App() {
  const baseName =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/Season2App')
      ? '/Season2App'
      : '/';
  return (
    <Router basename={baseName}>
      <Navbar />
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
              <ProtectedRoute roles={['admin', 'scorekeeper']}>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
