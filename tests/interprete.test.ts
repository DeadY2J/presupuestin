import { describe, expect, it } from "vitest";
import { audiosDeEjemplo, catalogo } from "@/presupuestin/config";
import { buscarPartida, extraerCantidad, frases, interpretar, normalizar } from "@/presupuestin/interprete";

const ids = () => {
  let n = 0;
  return () => `l${++n}`;
};

describe("intérprete de notas de obra", () => {
  it("normaliza tildes, mayúsculas y m²", () => {
    expect(normalizar("Colocar 6 M² de AZULEJO en el baño")).toBe("colocar 6 m2 de azulejo en el bano");
  });

  it("extrae cantidades en cifras, con decimales y en palabras", () => {
    expect(extraerCantidad("cambiar 2 llaves")).toBe(2);
    expect(extraerCantidad("2,5 m2 de azulejo")).toBe(2.5);
    expect(extraerCantidad("tres contactos")).toBe(3);
    expect(extraerCantidad("media hora")).toBe(0.5);
    expect(extraerCantidad("reparar la fuga")).toBeNull();
  });

  it("elige la partida que se nombra primero y, a igual posición, el sinónimo más largo", () => {
    expect(buscarPartida("tirar 25 metros de cable desde el tablero")?.id).toBe("cableado");
    expect(buscarPartida("tirar tuberia de cobre")?.id).toBe("tuberia");
    expect(buscarPartida("cambiar el centro de carga")?.id).toBe("tablero");
    expect(buscarPartida("cambiar 2 llaves mezcladoras")?.id).toBe("grifo");
  });

  it("no confunde palabras que contienen un sinónimo", () => {
    // "cablear" no es "cable", "focos" sí es foco, "cableado" sí.
    expect(buscarPartida("hay que cablearlo todo")).toBeNull();
    expect(buscarPartida("4 focos")?.id).toBe("luminaria");
  });

  it("separa frases por puntos, comas y 'y' entre acciones, conservando el texto original", () => {
    const f = frases("Cambiar 2 llaves y reparar la fuga. Revisar humedad del baño");
    expect(f.map((x) => x.normal)).toEqual(["cambiar 2 llaves", "reparar la fuga", "revisar humedad del bano"]);
    expect(f[2].original).toBe("Revisar humedad del baño");
  });

  it("convierte las notas del ejemplo en líneas con precio del catálogo", () => {
    const r = interpretar(audiosDeEjemplo[0].notas, ids());
    const porPartida = Object.fromEntries(r.lineas.map((l) => [l.partidaId ?? l.concepto, l.cantidad]));
    expect(porPartida).toMatchObject({ visita: 1, grifo: 2, fuga: 1, azulejo: 6, "mano-obra": 3 });
    expect(r.pendientes).toBe(1);
    const cocina = interpretar(audiosDeEjemplo[1].notas, ids());
    expect(Object.fromEntries(cocina.lineas.map((l) => [l.partidaId, l.cantidad]))).toEqual({
      visita: 1, contacto: 4, luminaria: 3, cableado: 25, tablero: 1, "mano-obra": 5,
    });
    expect(cocina.pendientes).toBe(0);
  });

  it("lo que no reconoce queda pendiente de precio, nunca con un precio inventado", () => {
    const r = interpretar("Revisar humedad en el techo del cuarto", ids());
    const pendiente = r.lineas.find((l) => l.partidaId === null)!;
    expect(pendiente.precioUnitario).toBeNull();
    expect(pendiente.concepto).toBe("Revisar humedad en el techo del cuarto");
  });

  it("ignora frases de relleno", () => {
    const r = interpretar("Hola, bueno. Listo, gracias", ids());
    expect(r.lineas).toEqual([]);
  });

  it("suma cantidades si la misma partida aparece dos veces", () => {
    const r = interpretar("2 contactos en la cocina. 3 contactos en la sala", ids());
    expect(r.lineas.find((l) => l.partidaId === "contacto")?.cantidad).toBe(5);
  });

  it("añade la visita una sola vez y con cantidad 1", () => {
    const r = interpretar("2 visitas. cambiar 1 sifón", ids());
    const visitas = r.lineas.filter((l) => l.partidaId === "visita");
    expect(visitas).toHaveLength(1);
    expect(visitas[0].cantidad).toBe(1);
    expect(interpretar("", ids()).lineas).toEqual([]);
  });

  it("todas las partidas del catálogo tienen sinónimos normalizados", () => {
    for (const p of catalogo) for (const s of p.sinonimos) expect(s).toBe(normalizar(s));
  });
});
