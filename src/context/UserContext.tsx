// Backward-compat shim — screens that call useUser() keep working without changes.
import { MOCK_USER } from '../api/mockData';
import { useAuth, AuthProvider } from './AuthContext';

export function useUser() {
  const { user, updateUser } = useAuth();
  return { user: user ?? MOCK_USER, updateUser };
}

export { AuthProvider as UserProvider };
