import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id?: number | string;
  username: string;
  role: string;
  token?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helper: read persisted auth from localStorage ─────────────────────────────
// [TEMPORARY BYPASS] Commented out to prevent overwriting hardcoded bypass user
/*
function readStoredAuth(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem('oracle_token');
    const raw   = localStorage.getItem('oracle_user');
    if (token && raw) {
      return { token, user: JSON.parse(raw) as AuthUser };
    }
  } catch {
    // ignore malformed data
  }
  return { user: null, token: null };
}
*/

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  // [TEMPORARY BYPASS] Hardcode admin user and bypass token
  const bypassUser: AuthUser = {
    username: 'admin',
    role: 'Admin',
    token: 'temporary-bypass-token',
  };

  const [user, setUser]   = useState<AuthUser | null>(bypassUser);
  const [token, setToken] = useState<string | null>('temporary-bypass-token');

  // [TEMPORARY BYPASS] Any useEffect checking localStorage on load is disabled/omitted
  // to avoid accidentally resetting the hardcoded user to null.

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message ?? 'Login failed.');
    }

    // Persist to localStorage so page refreshes keep the session
    localStorage.setItem('oracle_token', data.token);
    localStorage.setItem('oracle_user',  JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('oracle_token');
    localStorage.removeItem('oracle_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: true, // [TEMPORARY BYPASS] Always true
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
