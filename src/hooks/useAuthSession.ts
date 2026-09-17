import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { getSession, signInWithGoogle, signOut } from '../lib/circleAuth';

export interface AuthSessionState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

/**
 * Lightweight session hook for the optional circle cloud layer.
 * When VITE_SUPABASE_* is missing, configured=false and session stays null.
 */
export function useAuthSession(): AuthSessionState {
  const configured = isSupabaseConfigured;
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      setSession(null);
      return;
    }

    let cancelled = false;
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    void getSession().then((s) => {
      if (!cancelled) {
        setSession(s);
        setLoading(false);
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) {
        setSession(next);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  return {
    configured,
    loading,
    session,
    user: session?.user ?? null,
    signInWithGoogle,
    signOut,
  };
}
