/** Formatos para la interfaz y el PDF. Sin dependencias de Node: se usa también en el navegador. */
import type { Estado, Unidad } from "./tipos";

export function formatoDinero(centimos: number, codigo: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: codigo, minimumFractionDigits: 2 }).format(centimos / 100);
}

export const nombresUnidad: Record<Unidad, string> = { ud: "ud.", m: "m", m2: "m²", h: "h", servicio: "serv." };

export const nombresEstado: Record<Estado, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  firmado: "Firmado",
  rechazado: "Rechazado",
  vencido: "Vencido",
};
