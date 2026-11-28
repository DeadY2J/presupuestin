import { error, guardiaPanel, manejar } from "@/presupuestin/api";
import { generarPdf } from "@/presupuestin/pdf";
import { ipDe, limitar, mismoSecreto } from "@/presupuestin/seguridad";
import { servicio } from "@/presupuestin/servicio";

export const dynamic = "force-dynamic";

/**
 * PDF del presupuesto. Con ?t= lo descarga el cliente (solo el suyo y solo si ya
 * se envió); sin token, el autónomo desde el panel.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t");
  const s = servicio();
  let p;
  if (token) {
    if (!limitar(`pdf:${ipDe(req)}`, 20, 60_000)) return error("Demasiadas peticiones. Espera un minuto.", 429);
    p = s.paraCliente(id, token, mismoSecreto);
  } else {
    const bloqueo = guardiaPanel(req, 30);
    if (bloqueo) return bloqueo;
    p = s.almacen.obtener(id);
  }
  if (!p) return error("No encontramos ese presupuesto.", 404);
  const doc = p;
  return manejar(async () => {
    const bytes = await generarPdf(doc);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="presupuesto-${doc.numero}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
