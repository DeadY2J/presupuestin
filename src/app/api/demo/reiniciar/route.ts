import { error } from "@/presupuestin/api";
import { ipDe, limitar, modoDemo } from "@/presupuestin/seguridad";
import { reiniciarDemo } from "@/presupuestin/servicio";

export function POST(req: Request) {
  if (!modoDemo()) return new Response(null, { status: 404 });
  if (!limitar(`reinicio:${ipDe(req)}`, 5, 60_000)) return error("Demasiadas peticiones.", 429);
  reiniciarDemo();
  return Response.json({ ok: true });
}
