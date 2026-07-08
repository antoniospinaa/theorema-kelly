import type { Metadata } from "next";
import CarteraView from "@/components/CarteraView";

export const metadata: Metadata = {
  title: "Cartera multiactivo — Theorema Kelly",
};

export default function Page() {
  return <CarteraView />;
}
