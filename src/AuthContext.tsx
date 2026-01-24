import { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

interface AuthContextType {
    user: any;
    role: string | null;
    loading: boolean;
  }
const AuthContext = createContext<AuthContextType | null>(null);
  

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  const [loading, setLoading] = useState(true);

useEffect(() => {
  const auth = getAuth();
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    if (currentUser) {
      const ref = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setRole(snap.data().role);
      } else {
        setRole(null);
      }
    } else {
      setRole(null);
    }
    setLoading(false); // 🔥 importante
  });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role , loading}}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
