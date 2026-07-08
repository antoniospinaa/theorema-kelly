"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const path = usePathname();
  const tab = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <span className="brand">
          Theorema Kelly<span className="ver">v0.2.0</span>
        </span>
        <nav className="tabs" aria-label="Secciones">
          {tab("/", "Criterio")}
          {tab("/analisis", "Análisis")}
          {tab("/cartera", "Cartera")}
        </nav>
      </div>
    </header>
  );
}
