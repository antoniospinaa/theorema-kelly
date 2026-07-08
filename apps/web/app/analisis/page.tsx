import type { Metadata } from "next";
import AnalisisView from "@/components/AnalisisView";

export const metadata: Metadata = {
  title: "Análisis de trayectorias — Theorema Kelly",
};

export default function Page() {
  return <AnalisisView />;
}
