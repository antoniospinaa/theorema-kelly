"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_STATE, type KellyState } from "@/lib/state";
import { deriveKelly, type Derived } from "@/lib/derive";
import { detectLang, T } from "@/lib/i18n";

interface KellyContextValue {
  state: KellyState;
  derived: Derived;
  /** Translation table for the active language. */
  L: (typeof T)["es"];
  update: (patch: Partial<KellyState>) => void;
}

const KellyContext = createContext<KellyContextValue | null>(null);

export function KellyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KellyState>(DEFAULT_STATE);
  const update = (patch: Partial<KellyState>) => setState((s) => ({ ...s, ...patch }));
  const derived = useMemo(() => deriveKelly(state), [state]);
  const L = T[state.lang];

  // Detect browser language once on mount (saved preference wins).
  useEffect(() => {
    const lang = detectLang();
    setState((s) => (s.lang === lang ? s : { ...s, lang }));
  }, []);

  // Persist choice and keep <html lang> in sync.
  useEffect(() => {
    window.localStorage.setItem("tk-lang", state.lang);
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  return (
    <KellyContext.Provider value={{ state, derived, L, update }}>{children}</KellyContext.Provider>
  );
}

export function useKelly(): KellyContextValue {
  const ctx = useContext(KellyContext);
  if (!ctx) throw new Error("useKelly must be used within a KellyProvider");
  return ctx;
}
