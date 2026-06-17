"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseBrowser";

type Ctx = { session: Session | null; loading: boolean; signOut: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ session: null, loading: true, signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = supabase();
    (async () => {
      const { data } = await sb.auth.getSession();
      setSession(data.session);
      setLoading(false);
    })();
    const { data: sub } = sb.auth.onAuthStateChange((_e: AuthChangeEvent, s: Session | null) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase().auth.signOut();
  };

  return <AuthCtx.Provider value={{ session, loading, signOut }}>{children}</AuthCtx.Provider>;
}
