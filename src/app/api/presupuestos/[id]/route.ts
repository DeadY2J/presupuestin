import { error, esquemaAccion, esquemaEditar, guardiaPanel, leerJson, manejar } from "@/presupuestin/api";
import { modoDemo, origenPublico } from "@/presupuestin/seguridad";
import { servicio, vistaPanel } from "@/presupuestin/servicio";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const bloqueo = guardiaPanel(req, 240);
  if (bloqueo) return bloqueo;
  const p = servicio().almacen.obtener((await params).id);
  if (!p) return error("No existe ese presupuesto.", 404);
  return Response.json({ presupuesto: vistaPanel(p, origenPublico(req)) });
}

/** Edita un borrador: líneas, descuento o datos del cliente. */
export async function PATCH(req: Request, { params }: Ctx) {
  const bloqueo = guardiaPanel(req);
  if (bloqueo) return bloqueo;
  const { id } = await params;
  const r = await leerJson(req, esquemaEditar);
  if (!r.ok) return r.respuesta;
  return manejar(() => Response.json({ presupuesto: vistaPanel(servicio().actualizar(id, r.datos), origenPublico(req)) }));
}

/** Acciones: enviar, reabrir, añadir o quitar foto. */
export async function POST(req: Request, { params }: Ctx) {
  const bloqueo = guardiaPanel(req, 30);
  if (bloqueo) return bloqueo;
  const { id } = await params;
  const r = await leerJson(req, esquemaAccion);
  if (!r.ok) return r.respuesta;
  const origen = origenPublico(req);
  const s = servicio();
  return manejar(() => {
    const a = r.datos;
    switch (a.accion) {
      case "enviar": {
        const { presupuesto, whatsapp } = s.enviar(id, origen, { demo: modoDemo() });
        return Response.json({ presupuesto: vistaPanel(presupuesto, origen), whatsapp });
      }
      case "reabrir":
        return Response.json({ presupuesto: vistaPanel(s.reabrir(id), origen) });
      case "foto":
        return Response.json({ presupuesto: vistaPanel(s.agregarFoto(id, a.imagen), origen) });
      case "quitarFoto":
        return Response.json({ presupuesto: vistaPanel(s.quitarFoto(id, a.fotoId), origen) });
    }
  });
}
