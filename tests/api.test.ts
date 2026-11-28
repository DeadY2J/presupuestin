import { afterEach, describe, expect, it } from "vitest";
import { GET as listar, POST as crear } from "@/app/api/presupuestos/route";
import { GET as verFirma, POST as responder } from "@/app/api/firma/[id]/route";
import { GET as pdf } from "@/app/api/presupuestos/[id]/pdf/route";
import { reiniciarLimites } from "@/presupuestin/seguridad";
import { reiniciarDemo } from "@/presupuestin/servicio";

const json = (url: string, cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  new Request(url, { method: "POST", headers: { "Content-Type": "application/json", ...cabeceras }, body: JSON.stringify(cuerpo) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

afterEach(() => {
  delete process.env.PRESUPUESTIN_TOKEN;
  reiniciarLimites();
});

describe("rutas API", () => {
  it("con PRESUPUESTIN_TOKEN el panel exige la clave", async () => {
    process.env.PRESUPUESTIN_TOKEN = "clave-de-prueba-larga-123";
    expect((await listar(new Request("http://x/api/presupuestos"))).status).toBe(401);
    expect((await listar(new Request("http://x/api/presupuestos", { headers: { "x-presupuestin-token": "otra" } }))).status).toBe(401);
    expect((await listar(new Request("http://x/api/presupuestos", { headers: { "x-presupuestin-token": "clave-de-prueba-larga-123" } }))).status).toBe(200);
    process.env.PRESUPUESTIN_TOKEN = "corta";
    expect((await listar(new Request("http://x/api/presupuestos"))).status).toBe(503);
  });

  it("valida la entrada y rechaza cuerpos enormes", async () => {
    reiniciarDemo();
    expect((await crear(json("http://x/api/presupuestos", { cliente: { nombre: "A" }, notas: "x" }))).status).toBe(400);
    expect((await crear(new Request("http://x/api/presupuestos", { method: "POST", body: "no es json" }))).status).toBe(400);
    expect((await crear(json("http://x/api/presupuestos", {}, { "content-length": "9999999" }))).status).toBe(413);
    const ok = await crear(json("http://x/api/presupuestos", { cliente: { nombre: "Ana Ruiz", telefono: "+52 33 5555 0100", direccion: "" }, notas: "2 contactos" }));
    expect(ok.status).toBe(201);
  });

  it("el cliente solo ve su presupuesto con su token, y el PDF tampoco se filtra", async () => {
    reiniciarDemo();
    const { presupuestos } = await (await listar(new Request("http://x/api/presupuestos"))).json();
    const enviado = presupuestos.find((p: { estado: string }) => p.estado === "enviado");
    const token = new URL(enviado.enlaceFirma).searchParams.get("t")!;
    expect((await verFirma(new Request(`http://x/api/firma/${enviado.id}?t=malo`), ctx(enviado.id))).status).toBe(404);
    expect((await pdf(new Request(`http://x/api/presupuestos/${enviado.id}/pdf?t=malo`), ctx(enviado.id))).status).toBe(404);
    const vista = await (await verFirma(new Request(`http://x/api/firma/${enviado.id}?t=${token}`), ctx(enviado.id))).json();
    expect(vista.presupuesto.numero).toBe(enviado.numero);
    // Firmar con huella falsa no vale; con la huella vista, sí.
    const mal = await responder(json(`http://x/api/firma/${enviado.id}`, { accion: "firmar", t: token, nombre: "Sofía Medina", huella: "0".repeat(64), trazo: null, acepto: true }), ctx(enviado.id));
    expect(mal.status).toBe(409);
    const bien = await responder(json(`http://x/api/firma/${enviado.id}`, { accion: "firmar", t: token, nombre: "Sofía Medina", huella: vista.presupuesto.huella, trazo: null, acepto: true }), ctx(enviado.id));
    expect((await bien.json()).presupuesto.estado).toBe("firmado");
    const res = await pdf(new Request(`http://x/api/presupuestos/${enviado.id}/pdf?t=${token}`), ctx(enviado.id));
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("limita las respuestas del cliente por IP", async () => {
    reiniciarDemo();
    const estados: number[] = [];
    for (let i = 0; i < 12; i++) {
      estados.push((await responder(json("http://x/api/firma/no-existe", { accion: "rechazar", t: "x", motivo: "" }, { "x-forwarded-for": "1.2.3.4" }), ctx("no-existe"))).status);
    }
    expect(estados.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(estados.at(-1)).toBe(429);
  });
});
