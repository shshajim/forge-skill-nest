import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: string[];
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true, roles: [] });

  useEffect(() => {
    let mounted = true;
    async function loadRoles(userId: string) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      return (data ?? []).map((r: { role: string }) => r.role);
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const roles = session?.user ? await loadRoles(session.user.id) : [];
      setState({ user: session?.user ?? null, session, loading: false, roles });
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const roles = session?.user ? await loadRoles(session.user.id) : [];
      setState({ user: session?.user ?? null, session, loading: false, roles });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
