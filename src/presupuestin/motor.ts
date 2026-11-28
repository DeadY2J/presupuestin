/**
 * Motor de presupuestos: puro y testeable. Calcula importes en centavos y
 * gobierna el ciclo de vida (borrador → enviado → firmado / rechazado / vencido).
 * Sin IA, sin UI y sin almacenamiento: recibe un presupuesto y devuelve otro.
 */
import { createHash } from "node:crypto";
import { condiciones, impuesto, limites } from "./config";
import type { Estado, Firma, Linea, Presupuesto, Totales } from "./tipos";

export class ErrorPresupuesto extends Error {}

const DIA_MS = 86_400_000;

/** Redondeo comercial al centavo (la mitad, hacia arriba). */
const centavos = (n: number) => Math.round(n + Number.EPSILON);

export function redondearCantidad(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcular(p: Pick<Presupuesto, "lineas" | "descuentoPct">): Totales {
  const lineas = p.lineas.map((l) => ({
    ...l,
    importe: l.precioUnitario === null ? null : centavos(l.cantidad * l.precioUnitario),
  }));
  const subtotal = lineas.reduce((s, l) => s + (l.importe ?? 0), 0);
  const descuento = centavos((subtotal * p.descuentoPct) / 100);
  const base = subtotal - descuento;
  const imp = centavos(base * impuesto.tasa);
  const total = base + imp;
  const anticipo = centavos((total * condiciones.anticipoPct) / 100);
  return {
    lineas,
    subtotal,
    descuento,
    base,
    impuesto: imp,
    total,
    anticipo,
    saldo: total - anticipo,
    pendientes: lineas.filter((l) => l.importe === null).length,
  };
}

/** Estado real en un momento dado: un enviado sin respuesta pasada la validez está vencido. */
export function estadoEn(p: Presupuesto, ahora: Date): Estado {
  if (p.estado === "enviado" && p.venceEn && ahora.getTime() > new Date(p.venceEn).getTime()) return "vencido";
  return p.estado;
}

/** Valida una línea editada por el autónomo. Lanza ErrorPresupuesto con un mensaje legible. */
export function validarLinea(l: Linea): void {
  if (!l.concepto.trim()) throw new ErrorPresupuesto("Cada línea necesita un concepto.");
  if (!Number.isFinite(l.cantidad) || l.cantidad <= 0 || l.cantidad > limites.cantidadMax) {
    throw new ErrorPresupuesto(`La cantidad de "${l.concepto}" debe ser mayor que 0 y menor que ${limites.cantidadMax}.`);
  }
  if (l.precioUnitario !== null && (!Number.isInteger(l.precioUnitario) || l.precioUnitario < 0 || l.precioUnitario > limites.precioMax)) {
    throw new ErrorPresupuesto(`El precio de "${l.concepto}" no es válido.`);
  }
}

export function editar(p: Presupuesto, cambios: { lineas?: Linea[]; descuentoPct?: number; cliente?: Presupuesto["cliente"] }): Presupuesto {
  if (p.estado !== "borrador") throw new ErrorPresupuesto("Solo se puede editar un borrador. Reábrelo para hacer cambios.");
  const lineas = cambios.lineas?.map((l) => ({ ...l, cantidad: redondearCantidad(l.cantidad) })) ?? p.lineas;
  if (lineas.length > limites.lineas) throw new ErrorPresupuesto(`Máximo ${limites.lineas} líneas por presupuesto.`);
  lineas.forEach(validarLinea);
  const descuentoPct = cambios.descuentoPct ?? p.descuentoPct;
  if (!Number.isFinite(descuentoPct) || descuentoPct < 0 || descuentoPct > condiciones.descuentoMaxPct) {
    throw new ErrorPresupuesto(`El descuento debe estar entre 0 y ${condiciones.descuentoMaxPct} %.`);
  }
  return { ...p, lineas, descuentoPct, cliente: cambios.cliente ?? p.cliente };
}

/** Motivos que impiden enviar (vacío = se puede enviar). */
export function bloqueosDeEnvio(p: Presupuesto): string[] {
  const t = calcular(p);
  const motivos: string[] = [];
  if (p.lineas.length === 0) motivos.push("El presupuesto no tiene líneas.");
  if (t.pendientes > 0) motivos.push(`Faltan precios en ${t.pendientes} ${t.pendientes === 1 ? "línea" : "líneas"}.`);
  if (t.pendientes === 0 && p.lineas.length > 0 && t.total <= 0) motivos.push("El total debe ser mayor que 0.");
  if (p.cliente.nombre.trim().length < 2) motivos.push("Falta el nombre del cliente.");
  return motivos;
}

export function enviar(p: Presupuesto, ahora: Date): Presupuesto {
  if (p.estado !== "borrador") throw new ErrorPresupuesto("Este presupuesto ya se envió.");
  const motivos = bloqueosDeEnvio(p);
  if (motivos.length) throw new ErrorPresupuesto(motivos.join(" "));
  return {
    ...p,
    estado: "enviado",
    enviadoEn: ahora.toISOString(),
    venceEn: new Date(ahora.getTime() + condiciones.validezDias * DIA_MS).toISOString(),
  };
}

/**
 * Huella del contenido que el cliente acepta: si cambia una cifra, cambia la huella.
 * El cliente firma enviando la huella que vio; si no coincide, la firma se rechaza.
 */
export function huella(p: Presupuesto): string {
  const t = calcular(p);
  const contenido = {
    numero: p.numero,
    version: p.version,
    cliente: p.cliente,
    lineas: t.lineas.map((l) => [l.concepto, l.unidad, l.cantidad, l.precioUnitario, l.importe]),
    descuentoPct: p.descuentoPct,
    total: t.total,
    anticipo: t.anticipo,
    impuesto: [impuesto.nombre, impuesto.tasa],
    venceEn: p.venceEn,
  };
  return createHash("sha256").update(JSON.stringify(contenido)).digest("hex");
}

function exigirRespondible(p: Presupuesto, ahora: Date) {
  const estado = estadoEn(p, ahora);
  if (estado === "vencido") throw new ErrorPresupuesto("Este presupuesto venció. Pide al profesional que te envíe uno actualizado.");
  if (estado === "firmado") throw new ErrorPresupuesto("Este presupuesto ya está firmado.");
  if (estado === "rechazado") throw new ErrorPresupuesto("Este presupuesto fue rechazado.");
  if (estado !== "enviado") throw new ErrorPresupuesto("Este presupuesto todavía no está disponible para firmar.");
}

export function firmar(p: Presupuesto, datos: { nombre: string; huellaVista: string; trazoPng: string | null }, ahora: Date): Presupuesto {
  exigirRespondible(p, ahora);
  const nombre = datos.nombre.trim().replace(/\s+/g, " ");
  if (nombre.length < 3) throw new ErrorPresupuesto("Escribe tu nombre completo para firmar.");
  if (datos.huellaVista !== huella(p)) throw new ErrorPresupuesto("El presupuesto cambió desde que lo abriste. Recarga la página y revísalo de nuevo.");
  const firma: Firma = { nombre, fecha: ahora.toISOString(), huella: datos.huellaVista, trazoPng: datos.trazoPng };
  return { ...p, estado: "firmado", firma };
}

export function rechazar(p: Presupuesto, motivo: string, ahora: Date): Presupuesto {
  exigirRespondible(p, ahora);
  return { ...p, estado: "rechazado", rechazo: { fecha: ahora.toISOString(), motivo: motivo.trim().slice(0, 500) } };
}

/** Vuelve a borrador para ajustar: nueva versión y nuevo token (el enlace anterior deja de valer). */
export function reabrir(p: Presupuesto, nuevoToken: string): Presupuesto {
  if (p.estado === "borrador") throw new ErrorPresupuesto("Ya es un borrador.");
  if (p.estado === "firmado") throw new ErrorPresupuesto("Un presupuesto firmado no se modifica. Crea uno nuevo.");
  return { ...p, estado: "borrador", version: p.version + 1, token: nuevoToken, enviadoEn: null, venceEn: null, rechazo: null };
}

export { formatoDinero } from "./formato";
