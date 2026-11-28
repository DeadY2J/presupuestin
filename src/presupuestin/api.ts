/**
 * Utilidades compartidas por las rutas API: esquemas de entrada (Zod), control
 * de acceso del panel, límite de peticiones y traducción de errores del motor.
 */
import { z } from "zod";
import { condiciones, limites } from "./config";
import { ErrorPresupuesto } from "./motor";
import { accesoPanel, ipDe, limitar } from "./seguridad";

const texto = (max: number) => z.string().trim().max(max);

export const esquemaCliente = z.object({
  nombre: texto(80),
  telefono: texto(25).regex(/^[+\d\s()-]*$/, "Teléfono no válido"),
  direccion: texto(160),
});

export const esquemaCrear = z.object({
  cliente: esquemaCliente,
  notas: texto(limites.caracteresNotas),
});

export const esquemaLinea = z.object({
  id: z.string().min(1).max(64),
  partidaId: z.string().max(40).nullable(),
  concepto: texto(120).min(1),
  unidad: z.enum(["ud", "m", "m2", "h", "servicio"]),
  cantidad: z.number().finite(),
  precioUnitario: z.number().int().nullable(),
  origen: z.enum(["nota", "manual", "regla"]),
});

export const esquemaEditar = z.object({
  lineas: z.array(esquemaLinea).max(limites.lineas).optional(),
  descuentoPct: z.number().min(0).max(condiciones.descuentoMaxPct).optional(),
  cliente: esquemaCliente.optional(),
});

export const esquemaAccion = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("enviar") }),
  z.object({ accion: z.literal("reabrir") }),
  z.object({ accion: z.literal("foto"), imagen: z.string().max(2_100_000) }),
  z.object({ accion: z.literal("quitarFoto"), fotoId: z.string().max(64) }),
]);

export const esquemaRespuesta = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("firmar"),
    t: z.string().max(100),
    nombre: texto(80),
    huella: z.string().regex(/^[a-f0-9]{64}$/),
    trazo: z.string().max(300_000).nullable(),
    acepto: z.literal(true),
  }),
  z.object({ accion: z.literal("rechazar"), t: z.string().max(100), motivo: texto(500) }),
]);

/** Bytes máximos de un cuerpo JSON (una foto de 1,5 MB en base64 ocupa unos 2 MB). */
export const MAX_CUERPO = 2_500_000;

export const error = (mensaje: string, estado: number) => Response.json({ error: mensaje }, { status: estado });

/** Comprueba acceso y límite del panel. Devuelve una respuesta de error o null si puede seguir. */
export function guardiaPanel(req: Request, max = 60): Response | null {
  const acceso = accesoPanel(req);
  if (!acceso.ok) return error(acceso.error, acceso.estado);
  if (!limitar(`panel:${ipDe(req)}`, max, 60_000)) return error("Demasiadas peticiones. Espera un minuto.", 429);
  return null;
}

export async function leerJson<T>(req: Request, esquema: z.ZodType<T>): Promise<{ ok: true; datos: T } | { ok: false; respuesta: Response }> {
  // Tope de tamaño antes de leer el cuerpo (la foto más grande cabe con margen).
  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > MAX_CUERPO) return { ok: false, respuesta: error("La petición es demasiado grande.", 413) };
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return { ok: false, respuesta: error("El cuerpo de la petición no es JSON válido.", 400) };
  }
  const r = esquema.safeParse(cuerpo);
  if (!r.success) return { ok: false, respuesta: error("Datos no válidos.", 400) };
  return { ok: true, datos: r.data };
}

/** Errores del motor → 409 con su mensaje; cualquier otro → 500 genérico (sin detalles internos). */
export function manejar(fn: () => Response | Promise<Response>): Promise<Response> {
  return Promise.resolve()
    .then(fn)
    .catch((e: unknown) => {
      if (e instanceof ErrorPresupuesto) return error(e.message, 409);
      console.error(e);
      return error("Algo salió mal. Inténtalo de nuevo.", 500);
    });
}
