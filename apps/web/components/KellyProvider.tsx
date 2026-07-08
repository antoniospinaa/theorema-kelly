"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_STATE, type KellyState } from "@/lib/state";
import { deriveKelly, type Derived } from "@/lib/derive";

interface KellyContextValue {
  state: KellyState;
  derived: Derived;
  update: (patch: Partial<KellyState>) => void;
}

const KellyContext = createContext<KellyContextValue | null>(null);

export function KellyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<KellyState>(DEFAULT_STATE);
  const update = (patch: Partial<KellyState>) => setState((s) => ({ ...s, ...patch }));
  const derived = useMemo(() => deriveKelly(state), [state]);
  return (
    <KellyContext.Provider value={{ state, derived, update }}>{children}</KellyContext.Provider>
  );
}

export function useKelly(): KellyContextValue {
  const ctx = useContext(KellyContext);
  if (!ctx) throw new Error("useKelly must be used within a KellyProvider");
  return ctx;
}
