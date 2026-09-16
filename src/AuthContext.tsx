import { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { isAppRole } from './auth/roles';
import type { AppRole } from './auth/roles';

interface AuthContextType {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeRole: Unsubscribe | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      unsubscribeRole?.();
      unsubscribeRole = null;

      // Audience tracking uses Firebase Anonymous Auth only as invisible security plumbing.
      // Do not expose that anonymous session as a signed-in admin/user state in the UI.
      if (currentUser?.isAnonymous) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        const ref = doc(db, 'users', currentUser.uid);
        unsubscribeRole = onSnapshot(
          ref,
          (snap) => {
            const nextRole = snap.exists() ? snap.data().role : null;
            setRole(isAppRole(nextRole) ? nextRole : null);
            setLoading(false);
          },
          (error) => {
            console.error('Unable to load user role', error);
            setRole(null);
            setLoading(false);
          }
        );
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeRole?.();
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
