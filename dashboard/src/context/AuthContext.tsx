/**
 * AuthContext.tsx
 * Dashboard authentication state.
 *
 * Modes (driven by VITE_DEMO_MODE so the public demo keeps working):
 *   - demo mode (VITE_DEMO_MODE !== 'false'): the dashboard loads without login.
 *     Pair this with backend AUTH_ENABLED=false. A logged-in user is still
 *     honored if a token is present.
 *   - secure mode (VITE_DEMO_MODE === 'false'): login is required. Pair this
 *     with backend AUTH_ENABLED=true so the API also enforces auth.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  getCurrentUser,
  getAuthToken,
  clearAuthLocal,
  onUnauthorized,
  type AuthUser,
} from '../api';

export type AuthStatus = 'loading' | 'authenticated' | 'demo' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  demoMode: boolean;
  isAdmin: boolean;
  sessionMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearSessionMessage: () => void;
}

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const fallbackStatus = (): AuthStatus => (DEMO_MODE ? 'demo' : 'unauthenticated');

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setStatus(fallbackStatus());
      return;
    }
    try {
      const me = await getCurrentUser();
      setUser(me);
      setStatus('authenticated');
    } catch {
      clearAuthLocal();
      setUser(null);
      setStatus(fallbackStatus());
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // React to a 401 anywhere in the app (expired token mid-session).
  useEffect(() => {
    const off = onUnauthorized(() => {
      setUser(null);
      setStatus(fallbackStatus());
      setSessionMessage('Session expired. Please sign in again.');
    });
    return off;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await apiLogin(email, password);
    setUser(me);
    setStatus('authenticated');
    setSessionMessage(null);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus(fallbackStatus());
    setSessionMessage('Signed out successfully.');
  }, []);

  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  const value: AuthContextValue = {
    status,
    user,
    demoMode: DEMO_MODE,
    isAdmin: user?.role === 'admin',
    sessionMessage,
    login,
    logout,
    refresh,
    clearSessionMessage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
