import { Link } from 'react-router-dom';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { useAuth } from './AuthContext';
import { useSeason } from './hooks/useSeason';

const Navbar = () => {
  const auth = getAuth();
  const { user, role } = useAuth();
  const { seasons, selectedSeasonId, setSelectedSeasonId, isLoading } = useSeason();

  const login = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(console.error);
  };

  const logout = () => {
    signOut(auth);
  };

  return (
    <nav className="nav-bar px-4 py-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="nav-title text-xl sm:text-2xl font-bold text-center sm:text-left">Torneo de Vóley</h1>

        <ul className="flex flex-wrap justify-center sm:justify-start gap-3 text-sm sm:text-base">
          <li><Link to="/" className="nav-link">Inicio</Link></li>
          <li><Link to="/teams" className="nav-link">Equipos</Link></li>
          <li><Link to="/schedule" className="nav-link">Calendario</Link></li>
          <li><Link to="/leaderboard" className="nav-link">Posiciones</Link></li>
          <li><Link to="/players" className="nav-link">Jugadores</Link></li>
          {user && role === 'admin' && (
            <>
              <li><Link to="/matches" className="nav-link">Partidos</Link></li>
              <li><Link to="/admin/rosters" className="nav-link">Rosters</Link></li>
            </>
          )}
        </ul>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <label className="text-xs sm:text-sm">
            Temporada
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
          {user ? (
            <>
              <span className="text-sm text-center sm:text-left">Hola, {user.displayName}</span>
              <button
                onClick={logout}
                className="btn btn-danger px-3 py-1 text-sm"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="btn btn-outline px-3 py-1 text-sm"
            >
              Iniciar sesión
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
