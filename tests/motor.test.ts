import { describe, expect, it } from "vitest";
import { condiciones, impuesto } from "@/presupuestin/config";
import { bloqueosDeEnvio, calcular, editar, enviar, estadoEn, firmar, huella, rechazar, reabrir } from "@/presupuestin/motor";
import type { Linea, Presupuesto } from "@/presupuestin/tipos";

const ahora = new Date("2026-11-27T12:00:00Z");
const DIA = 86_400_000;

const linea = (cantidad: number, precio: number | null, concepto = "Partida"): Linea => ({
  id: concepto + cantidad,
  partidaId: null,
  concepto,
  unidad: "ud",
  cantidad,
  precioUnitario: precio,
  origen: "manual",
});

function base(lineas: Linea[] = [linea(2, 85_000, "Llave"), linea(1, 35_000, "Visita")]): Presupuesto {
  return {
    id: "p1", numero: "P-2026-0001", version: 1, token: "t1", estado: "borrador", creadoEn: ahora.toISOString(),
    enviadoEn: null, venceEn: null, cliente: { nombre: "Laura Gómez", telefono: "+52 33 5555 0187", direccion: "" },
    notas: "", lineas, descuentoPct: 0, fotos: [], firma: null, rechazo: null,
  };
}

describe("cálculo", () => {
  it("suma importes, aplica descuento, impuesto y anticipo en centavos", () => {
    const t = calcular({ ...base(), descuentoPct: 10 });
    expect(t.subtotal).toBe(205_000);
    expect(t.descuento).toBe(20_500);
    expect(t.base).toBe(184_500);
    expect(t.impuesto).toBe(Math.round(184_500 * impuesto.tasa));
    expect(t.total).toBe(t.base + t.impuesto);
    expect(t.anticipo + t.saldo).toBe(t.total);
    expect(t.anticipo).toBe(Math.round((t.total * condiciones.anticipoPct) / 100));
  });

  it("redondea cada línea al centavo", () => {
    const t = calcular({ lineas: [linea(2.5, 33_333)], descuentoPct: 0 });
    expect(t.lineas[0].importe).toBe(83_333);
  });

  it("las líneas sin precio cuentan como pendientes y no suman", () => {
    const t = calcular({ lineas: [linea(1, 10_000), linea(1, null)], descuentoPct: 0 });
    expect(t.pendientes).toBe(1);
    expect(t.subtotal).toBe(10_000);
  });
});

describe("edición", () => {
  it("valida cantidades, precios y descuento", () => {
    expect(() => editar(base(), { lineas: [linea(0, 100)] })).toThrow(/cantidad/);
    expect(() => editar(base(), { lineas: [linea(1, -5)] })).toThrow(/precio/);
    expect(() => editar(base(), { lineas: [linea(1, 10.5)] })).toThrow(/precio/);
    expect(() => editar(base(), { descuentoPct: condiciones.descuentoMaxPct + 1 })).toThrow(/descuento/);
    expect(editar(base(), { lineas: [linea(1.236, 100)] }).lineas[0].cantidad).toBe(1.24);
  });

  it("solo se edita un borrador", () => {
    const enviado = enviar(base(), ahora);
    expect(() => editar(enviado, { descuentoPct: 5 })).toThrow(/borrador/);
  });
});

describe("envío", () => {
  it("no se envía con precios pendientes, sin líneas o sin cliente", () => {
    expect(bloqueosDeEnvio(base([linea(1, null)]))).toEqual(["Faltan precios en 1 línea."]);
    expect(bloqueosDeEnvio(base([]))).toContain("El presupuesto no tiene líneas.");
    expect(bloqueosDeEnvio({ ...base(), cliente: { nombre: "", telefono: "", direccion: "" } })).toContain("Falta el nombre del cliente.");
    expect(() => enviar(base([linea(1, null)]), ahora)).toThrow(/Faltan precios/);
  });

  it("al enviar fija la fecha de vencimiento según la validez", () => {
    const p = enviar(base(), ahora);
    expect(p.estado).toBe("enviado");
    expect(new Date(p.venceEn!).getTime() - ahora.getTime()).toBe(condiciones.validezDias * DIA);
    expect(() => enviar(p, ahora)).toThrow(/ya se envió/);
  });

  it("pasada la validez queda vencido y no se puede firmar", () => {
    const p = enviar(base(), ahora);
    const despues = new Date(ahora.getTime() + (condiciones.validezDias + 1) * DIA);
    expect(estadoEn(p, despues)).toBe("vencido");
    expect(() => firmar(p, { nombre: "Laura Gómez", huellaVista: huella(p), trazoPng: null }, despues)).toThrow(/venció/);
  });
});

describe("firma", () => {
  it("firma con nombre y la huella del contenido visto", () => {
    const p = enviar(base(), ahora);
    const f = firmar(p, { nombre: "  Laura   Gómez ", huellaVista: huella(p), trazoPng: null }, ahora);
    expect(f.estado).toBe("firmado");
    expect(f.firma).toMatchObject({ nombre: "Laura Gómez", huella: huella(p) });
  });

  it("rechaza la firma si el contenido cambió desde que el cliente lo vio", () => {
    const p = enviar(base(), ahora);
    const vista = huella(p);
    const cambiado = { ...p, lineas: [linea(3, 85_000, "Llave")] };
    expect(() => firmar(cambiado, { nombre: "Laura Gómez", huellaVista: vista, trazoPng: null }, ahora)).toThrow(/cambió/);
  });

  it("exige nombre y no permite firmar dos veces ni un borrador", () => {
    const p = enviar(base(), ahora);
    expect(() => firmar(p, { nombre: "L", huellaVista: huella(p), trazoPng: null }, ahora)).toThrow(/nombre/);
    const f = firmar(p, { nombre: "Laura Gómez", huellaVista: huella(p), trazoPng: null }, ahora);
    expect(() => firmar(f, { nombre: "Laura Gómez", huellaVista: huella(p), trazoPng: null }, ahora)).toThrow(/ya está firmado/);
    expect(() => firmar(base(), { nombre: "Laura Gómez", huellaVista: huella(base()), trazoPng: null }, ahora)).toThrow(/todavía no/);
  });

  it("la huella cambia con cualquier cifra", () => {
    expect(huella(base())).not.toBe(huella({ ...base(), descuentoPct: 5 }));
    expect(huella(base())).toBe(huella(base()));
  });
});

describe("rechazo y reapertura", () => {
  it("el cliente puede rechazar y el autónomo reabrir con nueva versión y nuevo enlace", () => {
    const r = rechazar(enviar(base(), ahora), "Muy caro", ahora);
    expect(r.estado).toBe("rechazado");
    expect(r.rechazo?.motivo).toBe("Muy caro");
    const b = reabrir(r, "t2");
    expect(b).toMatchObject({ estado: "borrador", version: 2, token: "t2", rechazo: null, venceEn: null });
  });

  it("un firmado no se reabre", () => {
    const p = enviar(base(), ahora);
    const f = firmar(p, { nombre: "Laura Gómez", huellaVista: huella(p), trazoPng: null }, ahora);
    expect(() => reabrir(f, "t2")).toThrow(/firmado/);
    expect(() => reabrir(base(), "t2")).toThrow(/borrador/);
  });
});
