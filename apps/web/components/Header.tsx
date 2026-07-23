"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKelly } from "./KellyProvider";
import AuthButton from "./AuthButton";

export default function Header() {
  const path = usePathname();
  const { state, L, update } = useKelly();
  const tab = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <span className="brand">
          Theorema Kelly<span className="ver">v0.7.1</span>
        </span>
        <nav className="tabs" aria-label="Secciones">
          {tab("/", L.header.tabs.criterio)}
          {tab("/analisis", L.header.tabs.analisis)}
          {tab("/cartera", L.header.tabs.cartera)}
        </nav>
        <div className="seg mini view-toggle" role="group" aria-label={L.header.levelAria}>
          <button
            type="button"
            aria-pressed={state.view === "simple"}
            onClick={() => update({ view: "simple" })}
          >
            {L.header.simple}
          </button>
          <button
            type="button"
            aria-pressed={state.view === "lab"}
            title={L.header.labTitle}
            onClick={() => update({ view: "lab" })}
          >
            {L.header.lab}
          </button>
        </div>
        <div className="seg mini" role="group" aria-label={L.header.langAria}>
          <button
            type="button"
            aria-pressed={state.lang === "es"}
            onClick={() => update({ lang: "es" })}
          >
            ES
          </button>
          <button
            type="button"
            aria-pressed={state.lang === "en"}
            onClick={() => update({ lang: "en" })}
          >
            EN
          </button>
        </div>
        <AuthButton />
      </div>
    </header>
  );
}
