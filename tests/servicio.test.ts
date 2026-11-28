import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { audiosDeEjemplo, catalogo, condiciones, negocio } from "@/presupuestin/config";
import { huella } from "@/presupuestin/motor";
import { buscarModismos } from "@/presupuestin/neutro";
import { generarPdf, textoSeguro } from "@/presupuestin/pdf";
import { decodificarImagen, mismoSecreto } from "@/presupuestin/seguridad";
import { Servicio, vistaCliente, vistaPanel } from "@/presupuestin/servicio";
import { mensajeEnvio, numeroWhatsApp } from "@/presupuestin/whatsapp";

const ahora = new Date("2026-11-27T12:00:00Z");
// PNG de 1×1 píxel.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function nuevo() {
  let n = 0;
  let t = 0;
  return new Servicio(undefined, () => ahora, () => `id${++n}`, () => `token-${++t}-largo-y-aleatorio`);
}

function presupuestoListo(s: Servicio) {
  const ej = audiosDeEjemplo[1];
  return s.crear({ cliente: ej.cliente, notas: ej.notas });
}

describe("flujo completo", () => {
  it("de las notas al presupuesto firmado", () => {
    const s = nuevo();
    const p = presupuestoListo(s);
    expect(p.numero).toBe("P-2026-0001");
    expect(p.lineas.every((l) => l.precioUnitario !== null)).toBe(true);
    const { enlaceFirma, whatsapp } = s.enviar(p.id, "https://demo.example", { demo: true });
    expect(enlaceFirma).toBe(`https://demo.example/firma/${p.id}?t=token-1-largo-y-aleatorio`);
    expect(whatsapp.enlace).toContain(encodeURIComponent(enlaceFirma));
    const visto = s.paraCliente(p.id, "token-1-largo-y-aleatorio", mismoSecreto)!;
    const firmado = s.responder(visto, { accion: "firmar", nombre: "Martín Herrera", huella: huella(visto), trazo: PNG });
    expect(firmado.estado).toBe("firmado");
    expect(firmado.firma?.trazoPng).toBe(PNG);
  });

  it("el cliente solo accede con el token vigente y nunca a un borrador", () => {
    const s = nuevo();
    const p = presupuestoListo(s);
    expect(s.paraCliente(p.id, p.token, mismoSecreto)).toBeNull(); // borrador
    s.enviar(p.id, "https://x.example", { demo: true });
    expect(s.paraCliente(p.id, "otro", mismoSecreto)).toBeNull();
    expect(s.paraCliente(p.id, "", mismoSecreto)).toBeNull();
    expect(s.paraCliente("no-existe", p.token, mismoSecreto)).toBeNull();
    s.responder(s.paraCliente(p.id, p.token, mismoSecreto)!, { accion: "rechazar", motivo: "Prefiero otra fecha" });
    s.reabrir(p.id);
    // Tras reabrir, el enlace anterior deja de funcionar.
    expect(s.paraCliente(p.id, p.token, mismoSecreto)).toBeNull();
  });

  it("valida fotos y trazos por su contenido real", () => {
    const s = nuevo();
    const p = presupuestoListo(s);
    expect(s.agregarFoto(p.id, PNG).fotos).toHaveLength(1);
    expect(() => s.agregarFoto(p.id, "data:image/png;base64,PGh0bWw+")).toThrow(/JPG o PNG/);
    expect(() => s.agregarFoto(p.id, "data:text/html;base64,PGh0bWw+")).toThrow(/JPG o PNG/);
    expect(decodificarImagen(PNG, 10)).toBeNull(); // supera el tamaño
    s.enviar(p.id, "https://x.example", { demo: true });
    const visto = s.paraCliente(p.id, p.token, mismoSecreto)!;
    expect(() => s.responder(visto, { accion: "firmar", nombre: "Martín Herrera", huella: huella(visto), trazo: "data:image/png;base64,AAAA" })).toThrow(/firma dibujada/);
  });

  it("la vista del cliente no expone notas internas, token ni el trazo", () => {
    const s = nuevo();
    const p = presupuestoListo(s);
    s.enviar(p.id, "https://x.example", { demo: true });
    const v = vistaCliente(s.almacen.obtener(p.id)!, ahora);
    const json = JSON.stringify(v);
    expect(json).not.toContain(p.token);
    expect(v).not.toHaveProperty("notas");
    expect(v.huella).toHaveLength(64);
    expect(vistaPanel(s.almacen.obtener(p.id)!, "https://x.example", ahora).enlaceFirma).toContain(p.token);
  });

  it("los datos de ejemplo arrancan con un firmado y un enviado", () => {
    const s = nuevo();
    s.sembrar();
    expect(s.almacen.listar().map((p) => p.estado).sort()).toEqual(["enviado", "firmado"]);
  });
});

describe("PDF", () => {
  it("genera un PDF válido con fotos, firma y caracteres especiales", async () => {
    const s = nuevo();
    const p = s.crear({ cliente: { nombre: "Ñandú Pérez 😀", telefono: "", direccion: "" }, notas: audiosDeEjemplo[0].notas + " Revisión del baño ¿hoy?" });
    s.agregarFoto(p.id, PNG);
    const bytes = await generarPdf(s.almacen.obtener(p.id)!, ahora);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe(`Presupuesto ${p.numero}`);
  });

  it("pasa a varias páginas con muchas líneas", async () => {
    const s = nuevo();
    const notas = Array.from({ length: 38 }, (_, i) => `Revisar el punto número ${i + 1} de la instalación de la casa`).join(". ");
    const p = s.crear({ cliente: { nombre: "Cliente", telefono: "", direccion: "" }, notas });
    const doc = await PDFDocument.load(await generarPdf(p, ahora));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("textoSeguro elimina lo que Helvetica no puede dibujar", () => {
    expect(textoSeguro("Año ¿qué? m² 😀 €")).toBe("Año ¿qué? m²  €");
  });
});

describe("WhatsApp y español neutro", () => {
  it("normaliza teléfonos y no pone número en modo demo", () => {
    expect(numeroWhatsApp("+52 33 5555 0187")).toBe("523355550187");
    expect(numeroWhatsApp("33 5555 0187")).toBeNull();
    const s = nuevo();
    const p = presupuestoListo(s);
    expect(mensajeEnvio(p, "https://x.example", { demo: true }).numero).toBeNull();
    expect(mensajeEnvio(p, "https://x.example", { demo: false }).enlace).toMatch(/^https:\/\/wa\.me\/523355550163\?text=/);
  });

  it("mensaje, catálogo, condiciones y datos de ejemplo están en español neutro", () => {
    const s = nuevo();
    const p = presupuestoListo(s);
    const textos = [
      mensajeEnvio(p, "https://x.example", { demo: true }).texto,
      ...catalogo.map((c) => c.nombre),
      ...Object.values(condiciones).filter((v): v is string => typeof v === "string"),
      ...audiosDeEjemplo.flatMap((a) => [a.titulo, a.notas]),
      negocio.oficio,
    ];
    for (const t of textos) expect(buscarModismos(t)).toEqual([]);
  });
});

describe("interfaz en español neutro", () => {
  it("los textos de la interfaz y del PDF no llevan voseo ni modismos", async () => {
    const { readFileSync } = await import("node:fs");
    for (const archivo of ["src/app/taller.tsx", "src/app/firma/[id]/firma-cliente.tsx", "src/presupuestin/pdf.ts", "src/presupuestin/motor.ts"]) {
      expect(buscarModismos(readFileSync(archivo, "utf8")), archivo).toEqual([]);
    }
  });
});
