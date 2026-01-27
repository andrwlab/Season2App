import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Páginas principales

import ProtectedRoute from './ProtectedRoute';
import Admin from './pages/Admin'; // o el nombre que uses
import Navbar from './Navbar';
import Leaderboard from './pages/Leaderboard';
import Matches from './pages/Matches';
import Players from './pages/Players';
import Teams from './pages/Teams';
import Schedule from './pages/Schedule';
import Home from './pages/Home';
import MatchDetail from './pages/MatchDetail';
import AdminMatch from './pages/AdminMatch';
import TeamDetail from './pages/TeamDetail';
import PlayerProfile from './pages/PlayerProfile';
import AdminRosters from './pages/AdminRosters';
import CumulativeStats from './pages/CumulativeStats';

function App() {
  const baseName =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/Season2App')
      ? '/Season2App'
      : '/';
  return (
    <Router basename={baseName}>
      <Navbar />
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

    </Router>
  );
}

export default App;
