import type { Provider, Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';

export { isSupabaseConfigured };

/** Redirect back to the SPA root after OAuth (GitHub Pages base `/Sillage/`). */
export function authRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export async function getSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) {
    console.warn('[sillage] getSession', error.message);
    return null;
  }
  return data.session;
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) {
    return { error: 'Le cloud n’est pas configuré sur cet appareil.' };
  }
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google' satisfies Provider,
    options: {
      redirectTo: authRedirectUrl(),
      queryParams: { prompt: 'select_account' },
    },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: null };
  const { error } = await sb.auth.signOut();
  return { error: error?.message ?? null };
}

export type { Session, User };
