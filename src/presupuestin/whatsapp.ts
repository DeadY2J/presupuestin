/**
 * Mensaje de WhatsApp para enviar el presupuesto al cliente. Plantilla
 * determinista: la envía el autónomo desde su teléfono abriendo el enlace wa.me.
 * Sin envíos automáticos: no hace falta ninguna cuenta de WhatsApp Business.
 */
import { condiciones, moneda, negocio } from "./config";
import { calcular, formatoDinero } from "./motor";
import type { Presupuesto } from "./tipos";

export type MensajeWhatsApp = { texto: string; enlace: string; numero: string | null };

/** Solo dígitos con código de país. null si no parece un teléfono internacional. */
export function numeroWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono || !telefono.trim().startsWith("+")) return null;
  const d = telefono.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 15 ? d : null;
}

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] ?? "";

export function mensajeEnvio(p: Presupuesto, enlaceFirma: string, opciones: { demo: boolean }): MensajeWhatsApp {
  const t = calcular(p);
  const dinero = (c: number) => formatoDinero(c, moneda.codigo, moneda.locale);
  const texto = [
    `Hola, ${primerNombre(p.cliente.nombre)}. Soy ${negocio.titular}, de ${negocio.nombre}.`,
    `Te comparto el presupuesto ${p.numero} del trabajo que revisamos: total ${dinero(t.total)} con impuestos incluidos.`,
    `Puedes revisarlo, descargar el PDF y aceptarlo con tu firma aquí: ${enlaceFirma}`,
    `Es válido por ${condiciones.validezDias} días. Si tienes cualquier duda, respóndeme por aquí.`,
  ].join("\n\n");
  const numero = opciones.demo ? null : numeroWhatsApp(p.cliente.telefono);
  return { texto, enlace: `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(texto)}`, numero };
}
