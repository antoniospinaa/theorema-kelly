"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useKelly } from "./KellyProvider";

/** Google sign-in via Supabase Auth (Fase 5). Hidden if no backend is configured. */
export default function AuthButton() {
  const { L } = useKelly();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabase) return null;

  if (user) {
    const meta = user.user_metadata as { name?: string; full_name?: string };
    const first = (meta.name ?? meta.full_name ?? user.email ?? "").split(" ")[0];
    return (
      <div className="auth-box">
        <span className="auth-name" title={user.email ?? undefined}>
          {first}
        </span>
        <button type="button" className="btn" onClick={() => void supabase?.auth.signOut()}>
          {L.auth.signOut}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() =>
        void supabase?.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        })
      }
    >
      {L.auth.signIn}
    </button>
  );
}
