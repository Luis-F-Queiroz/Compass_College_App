"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { useAuth } from "@/components/AuthProvider";

export type Row = Record<string, unknown> & { id: string };

// Generic per-table data hook: list + create/update/delete. RLS scopes to the user.
export function useCollection(table: string) {
  const { session, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setRows([]);
      setLoading(authLoading); // keep showing "loading" while the silent session establishes
      return;
    }
    const { data } = await supabase()
      .from(table)
      .select("*")
      .eq("archived", false) // hide archived (sync-archived or soft-deleted) rows; they are never destroyed
      .order("created_at", { ascending: false });
    setRows((data as Row[]) || []);
    setLoading(false);
  }, [table, session, authLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (values: Record<string, unknown>) => {
      if (!session) return null;
      const { data, error } = await supabase()
        .from(table)
        .insert({ ...values, user_id: session.user.id })
        .select()
        .single();
      if (error) throw error;
      await refresh();
      return data as Row;
    },
    [table, session, refresh],
  );

  const update = useCallback(
    async (id: string, values: Record<string, unknown>) => {
      const { error } = await supabase().from(table).update(values).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [table, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      // Synced rows (provenance set) are ARCHIVED, not deleted: keeps them recoverable and stops the
      // next sync from resurrecting them by source_ref. Manually-created rows hard-delete as before.
      const row = rows.find((r) => r.id === id);
      const synced = row && row.source != null;
      const q = supabase().from(table);
      const { error } = synced
        ? await q.update({ archived: true }).eq("id", id)
        : await q.delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [table, refresh, rows],
  );

  return { rows, loading, create, update, remove, refresh, authed: !!session };
}
