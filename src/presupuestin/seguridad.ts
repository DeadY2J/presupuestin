/**
 * Seguridad de las rutas API.
 *  - Panel del autónomo: en modo demo (sin PRESUPUESTIN_TOKEN) está abierto y solo
 *    hay datos ficticios. Con PRESUPUESTIN_TOKEN configurado exige la cabecera
 *    x-presupuestin-token: los presupuestos y los datos de los clientes son privados.
 *  - Enlace del cliente: cada presupuesto tiene su propio token aleatorio. El cliente
 *    solo ve y firma ese presupuesto, nunca los demás.
 *  - limitar(): límite de peticiones por clave (IP) en ventana deslizante, en memoria.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const resumen = (t: string) => createHash("sha256").update(t).digest();

/** Comparación en tiempo constante de dos secretos de cualquier longitud. */
export function mismoSecreto(recibido: string, esperado: string): boolean {
  return timingSafeEqual(resumen(recibido), resumen(esperado));
}

export function tokenAleatorio(): string {
  return randomBytes(24).toString("base64url");
}

export function modoDemo(): boolean {
  return !process.env.PRESUPUESTIN_TOKEN?.trim();
}

export type Acceso = { ok: true } | { ok: false; estado: 401 | 503; error: string };

export function accesoPanel(req: Request): Acceso {
  const esperado = process.env.PRESUPUESTIN_TOKEN?.trim();
  if (!esperado) return { ok: true };
  if (esperado.length < 16) return { ok: false, estado: 503, error: "PRESUPUESTIN_TOKEN debe tener 16 caracteres o más." };
  const recibido = req.headers.get("x-presupuestin-token") ?? "";
  return mismoSecreto(recibido, esperado) ? { ok: true } : { ok: false, estado: 401, error: "Clave de acceso incorrecta." };
}

const ventanas = new Map<string, number[]>();

/** Devuelve true si la petición cabe en el límite; false si hay que rechazarla (429). */
export function limitar(clave: string, max: number, ventanaMs: number, ahora: number = Date.now()): boolean {
  const recientes = (ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (recientes.length >= max) {
    ventanas.set(clave, recientes);
    return false;
  }
  recientes.push(ahora);
  ventanas.set(clave, recientes);
  if (ventanas.size > 5000) for (const [k, v] of ventanas) if (!v.some((t) => ahora - t < ventanaMs)) ventanas.delete(k);
  return true;
}

export function ipDe(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function reiniciarLimites() {
  ventanas.clear();
}

/** Origen público para el enlace del cliente: PRESUPUESTIN_URL_PUBLICA o el de la petición. */
export function origenPublico(req: Request): string {
  const configurado = process.env.PRESUPUESTIN_URL_PUBLICA?.trim().replace(/\/$/, "");
  if (configurado && /^https?:\/\//.test(configurado)) return configurado;
  return new URL(req.url).origin;
}

/**
 * Decodifica una imagen en data URL y comprueba su firma binaria real (no se fía
 * del tipo declarado). Devuelve null si no es un JPEG o PNG válido o supera el tamaño.
 */
export function decodificarImagen(dataUrl: string, maxBytes: number): { tipo: "jpg" | "png"; datos: Uint8Array } | null {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m || (m[2].length * 3) / 4 > maxBytes + 4) return null;
  const datos = new Uint8Array(Buffer.from(m[2], "base64"));
  if (datos.length === 0 || datos.length > maxBytes) return null;
  const esPng = datos[0] === 0x89 && datos[1] === 0x50 && datos[2] === 0x4e && datos[3] === 0x47;
  const esJpg = datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff;
  if (esPng) return { tipo: "png", datos };
  if (esJpg) return { tipo: "jpg", datos };
  return null;
}
