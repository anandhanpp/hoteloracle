import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// ── Context shape ─────────────────────────────────────────────────────────────
interface ReservationContextValue {
  /** Increment this counter to signal all consumers to re-fetch. */
  refreshToken: number;
  /** Call this from any page after a mutation (add / edit / delete). */
  triggerRefresh: () => void;
}

const ReservationContext = createContext<ReservationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function ReservationProvider({ children }: { children: React.ReactNode }) {
  const [refreshToken, setRefreshToken] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshToken((t) => t + 1);
  }, []);

  const value = useMemo(
    () => ({ refreshToken, triggerRefresh }),
    [refreshToken, triggerRefresh]
  );

  return (
    <ReservationContext.Provider value={value}>
      {children}
    </ReservationContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useReservationSync() {
  const ctx = useContext(ReservationContext);
  if (!ctx) {
    throw new Error('useReservationSync must be used inside <ReservationProvider>');
  }
  return ctx;
}
