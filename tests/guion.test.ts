import { describe, expect, it } from "vitest";
import { DURACION_GUION, ejemploGuion, guion, precioManualGuion } from "@/presupuestin/guion";
import { interpretar } from "@/presupuestin/interprete";
import { buscarModismos } from "@/presupuestin/neutro";
import { limites } from "@/presupuestin/config";

describe("Guion del modo presentación", () => {
  it("sigue los seis pasos en orden y cabe en 60 segundos", () => {
    expect(guion.map((p) => p.id)).toEqual(["dolor", "obra", "precio", "enviar", "cliente", "sello"]);
    const inicios = guion.map((p) => p.desde);
    expect(inicios[0]).toBe(0);
    expect([...inicios].sort((a, b) => a - b)).toEqual(inicios);
    expect(inicios.at(-1)!).toBeLessThan(DURACION_GUION);
    expect(DURACION_GUION).toBe(60);
  });

  it("el audio de ejemplo deja exactamente una línea sin precio para el paso «No inventa nada»", () => {
    let n = 0;
    const { lineas } = interpretar(ejemploGuion.notas, () => `l${++n}`);
    expect(lineas.filter((l) => l.precioUnitario === null)).toHaveLength(1);
    expect(precioManualGuion).toBeGreaterThan(0);
    expect(precioManualGuion).toBeLessThanOrEqual(limites.precioMax);
  });

  it("todos los textos están en español neutro", () => {
    for (const p of guion) expect(buscarModismos(`${p.titulo} ${p.texto}`)).toEqual([]);
  });
});
