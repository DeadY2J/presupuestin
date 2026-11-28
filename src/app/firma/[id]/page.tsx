import type { Metadata } from "next";
import { FirmaCliente } from "./firma-cliente";

export const metadata: Metadata = { title: "Tu presupuesto · Presupuestín", referrer: "no-referrer" };

export default async function PaginaFirma({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t } = await searchParams;
  return <FirmaCliente id={id} token={typeof t === "string" ? t : ""} />;
}
