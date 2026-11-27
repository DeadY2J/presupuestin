import { error, esquemaCrear, guardiaPanel, leerJson, manejar } from "@/presupuestin/api";
import { origenPublico } from "@/presupuestin/seguridad";
import { servicio, vistaPanel } from "@/presupuestin/servicio";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const bloqueo = guardiaPanel(req, 120);
  if (bloqueo) return bloqueo;
  const origen = origenPublico(req);
  return Response.json({ presupuestos: servicio().almacen.listar().map((p) => vistaPanel(p, origen)) });
}

export async function POST(req: Request) {
  const bloqueo = guardiaPanel(req, 20);
  if (bloqueo) return bloqueo;
  const r = await leerJson(req, esquemaCrear);
  if (!r.ok) return r.respuesta;
  if (!r.datos.notas) return error("Escribe o dicta las notas de la obra.", 400);
  return manejar(() => {
    const p = servicio().crear(r.datos);
    return Response.json({ presupuesto: vistaPanel(p, origenPublico(req)) }, { status: 201 });
  });
}
