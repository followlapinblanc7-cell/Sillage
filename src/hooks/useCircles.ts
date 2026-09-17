import { useCallback, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export interface CircleSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  memberCount: number;
}

/**
 * Placeholder circle list for Tiroir — loads memberships when signed in.
 * Create / invite / share APIs are stubbed for a later pass.
 */
export function useCircles(userId: string | null | undefined) {
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) {
      setCircles([]);
      setError(null);
      setLoading(false);
      return;
    }
    const sb = getSupabase();
    if (!sb) return;

    setLoading(true);
    setError(null);
    try {
      const { data: memberships, error: memErr } = await sb
        .from('circle_members')
        .select('circle_id, role, circles ( id, name )')
        .eq('user_id', userId);

      if (memErr) throw memErr;

      const rows = memberships ?? [];
      const summaries: CircleSummary[] = [];

      for (const row of rows) {
        const circleRaw = row.circles as
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null;
        const circle = Array.isArray(circleRaw) ? circleRaw[0] : circleRaw;
        if (!circle) continue;

        const { count } = await sb
          .from('circle_members')
          .select('*', { count: 'exact', head: true })
          .eq('circle_id', circle.id);

        summaries.push({
          id: circle.id,
          name: circle.name,
          role: row.role === 'owner' ? 'owner' : 'member',
          memberCount: count ?? 0,
        });
      }

      setCircles(summaries);
    } catch (e) {
      setCircles([]);
      setError(e instanceof Error ? e.message : 'Impossible de charger les cercles.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { circles, loading, error, refresh };
}
