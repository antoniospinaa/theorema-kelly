"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKelly } from "./KellyProvider";

export default function Header() {
  const path = usePathname();
  const { state, update } = useKelly();
  const tab = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <span className="brand">
          Theorema Kelly<span className="ver">v0.5.1</span>
        </span>
        <nav className="tabs" aria-label="Secciones">
          {tab("/", "Criterio")}
          {tab("/analisis", "Análisis")}
          {tab("/cartera", "Cartera")}
        </nav>
        <div className="seg mini view-toggle" role="group" aria-label="Nivel de detalle">
          <button
            type="button"
            aria-pressed={state.view === "simple"}
            onClick={() => update({ view: "simple" })}
          >
            Simple
          </button>
          <button
            type="button"
            aria-pressed={state.view === "lab"}
            title="Muestra la capa técnica completa: curva G(f), percentiles, backtest, glosario"
            onClick={() => update({ view: "lab" })}
          >
            Laboratorio
          </button>
        </div>
      </div>
    </header>
  );
}
