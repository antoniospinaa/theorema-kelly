import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { KellyProvider } from "@/components/KellyProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Theorema Kelly — Laboratorio de Crecimiento Geométrico",
  description:
    "Calculadora educativa del Criterio de Kelly: fracción óptima, tasa de crecimiento G(f) y simulación de Monte Carlo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        {/* stylesheet links are valid in <body>; avoids next/font build-time fetch */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@600&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <KellyProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </KellyProvider>
      </body>
    </html>
  );
}
