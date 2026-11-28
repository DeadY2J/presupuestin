import { error, esquemaRespuesta, leerJson, manejar } from "@/presupuestin/api";
import { ipDe, limitar, mismoSecreto } from "@/presupuestin/seguridad";
import { servicio, vistaCliente } from "@/presupuestin/servicio";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const noEncontrado = () => error("Este enlace no es válido o ya no está vigente. Pide uno nuevo al profesional.", 404);

/** Vista del cliente: exige el token de su enlace personal. */
export async function GET(req: Request, { params }: Ctx) {
  if (!limitar(`firma:${ipDe(req)}`, 60, 60_000)) return error("Demasiadas peticiones. Espera un minuto.", 429);
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const p = servicio().paraCliente((await params).id, token, mismoSecreto);
  return p ? Response.json({ presupuesto: vistaCliente(p) }) : noEncontrado();
}

/** El cliente firma o rechaza. */
export async function POST(req: Request, { params }: Ctx) {
  if (!limitar(`responder:${ipDe(req)}`, 10, 60_000)) return error("Demasiadas peticiones. Espera un minuto.", 429);
  const r = await leerJson(req, esquemaRespuesta);
  if (!r.ok) return r.respuesta;
  const s = servicio();
  const p = s.paraCliente((await params).id, r.datos.t, mismoSecreto);
  if (!p) return noEncontrado();
  const d = r.datos;
  return manejar(() => {
    const hecho =
      d.accion === "firmar"
        ? s.responder(p, { accion: "firmar", nombre: d.nombre, huella: d.huella, trazo: d.trazo })
        : s.responder(p, { accion: "rechazar", motivo: d.motivo });
    return Response.json({ presupuesto: vistaCliente(hecho) });
  });
}
