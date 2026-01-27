import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut } from 'firebase/auth';
import { useAuth } from './AuthContext';
import { useSeason } from './hooks/useSeason';

const Navbar = () => {
  const auth = getAuth();
  const { user, role } = useAuth();
  const { seasons, selectedSeasonId, setSelectedSeasonId, isLoading } = useSeason();
  const activeSeason = seasons.find((s) => s.isActive) || seasons[0] || null;
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'admin' && activeSeason && selectedSeasonId !== activeSeason.id) {
      setSelectedSeasonId(activeSeason.id);
    }
  }, [role, activeSeason, selectedSeasonId, setSelectedSeasonId]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError(null);

    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error(error);
      const errorCode = error?.code as string | undefined;
      if (errorCode === 'auth/popup-blocked') {
        setAuthError('Popup blocked. Redirecting to the sign-in page...');
        await signInWithRedirect(auth, provider);
        return;
      }
      if (errorCode === 'auth/unauthorized-domain') {
        setAuthError(
          `Sign-in is disabled for ${window.location.hostname}. Add this domain in Firebase Auth settings.`
        );
        return;
      }

      if (errorCode === 'auth/popup-closed-by-user') {
        setAuthError('Popup closed before completing sign-in.');
        return;
      }

      setAuthError('Unable to sign in. Please try again.');
    }
  };

  const logout = () => {
    signOut(auth);
  };

  return (
    <nav className="nav-bar px-4 py-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="nav-title text-xl sm:text-2xl font-bold text-center sm:text-left">Volleyball Tournament</h1>

        <ul className="flex flex-wrap justify-center sm:justify-start gap-3 text-sm sm:text-base">
          <li>
            <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/teams" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
              Teams
            </NavLink>
          </li>
          <li>
            <NavLink to="/schedule" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
              Schedule
            </NavLink>
          </li>
          <li>
            <NavLink to="/leaderboard" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
              Standings
            </NavLink>
          </li>
          <li>
            <NavLink to="/players" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
              Players
            </NavLink>
          </li>
          <li>
            <NavLink to="/cumulative" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
              Cumulative
            </NavLink>
          </li>
          {user && role === 'admin' && (
            <>
              <li>
                <NavLink to="/matches" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
                  Matches
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin/rosters" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
                  Rosters
                </NavLink>
              </li>
            </>
          )}
        </ul>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          {role === 'admin' ? (
            <label className="text-xs sm:text-sm">
              Season
              <select
                className="input-field ml-2 px-2 py-1 text-sm"
                value={selectedSeasonId || ''}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                disabled={isLoading || seasons.length === 0}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-xs sm:text-sm">
              Season: {activeSeason?.name || '—'}
            </span>
          )}
          {user ? (
            <>
              <span className="text-sm text-center sm:text-left">Hi, {user.displayName}</span>
              <button
                onClick={logout}
                className="btn btn-danger px-3 py-1 text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={login}
                className="btn btn-signin px-4 py-1 text-sm"
              >
                Sign in
              </button>
              {authError && (
                <span className="text-xs text-red-500 text-center max-w-[220px]">{authError}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
