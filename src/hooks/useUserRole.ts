import { useAuth } from '../AuthContext';

const useUserRole = () => {
  const auth = useAuth();
  return auth?.role ?? null;
};

export default useUserRole;
