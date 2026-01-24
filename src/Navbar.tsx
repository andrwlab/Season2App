import { Link } from 'react-router-dom';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { useAuth } from './AuthContext';

const Navbar = () => {
  const auth = getAuth();
  const { user, role } = useAuth();

  const login = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(console.error);
  };

  const logout = () => {
    signOut(auth);
  };

  return (
    <nav className="navbar px-4 py-4 sm:px-6 shadow-soft">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-center sm:text-left">Torneo de Vóley</h1>

        <ul className="flex flex-wrap justify-center sm:justify-start gap-3 text-sm sm:text-base">
          <li><Link to="/" className="navbar-link">Inicio</Link></li>
          <li><Link to="/teams" className="navbar-link">Equipos</Link></li>
          <li><Link to="/schedule" className="navbar-link">Calendario</Link></li>
          <li><Link to="/leaderboard" className="navbar-link">Posiciones</Link></li>
          <li><Link to="/players" className="navbar-link">Jugadores</Link></li>
          {user && role === 'admin' && (
            <li><Link to="/matches" className="navbar-link">Partidos</Link></li>
          )}
        </ul>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-center sm:text-left text-muted">Hola, {user.displayName}</span>
              <button
                onClick={logout}
                className="btn-danger px-3 py-1 text-sm"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="navbar-cta px-3 py-1 text-sm"
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
