/**
 * Intérprete de notas de obra (texto escrito o transcripción de un audio).
 * Convierte frases como "cambiar 2 llaves mezcladoras y 6 m2 de azulejo" en
 * líneas del catálogo. Es determinista y sin IA: lo que no reconoce queda como
 * línea "pendiente de precio" para que el autónomo la complete. Nunca inventa precios.
 */
import { catalogo, condiciones } from "./config";
import type { Linea, Partida, Unidad } from "./tipos";

const MARCAS = /[\u0300-\u036f]/g;

/** Minúsculas, sin tildes y con "²" como "2". Conserva la longitud carácter a carácter. */
export function normalizarIgualLargo(texto: string): string {
  return Array.from(texto, (c) => {
    if (/\s/.test(c)) return " ";
    if (c === "²") return "2";
    const n = c.toLowerCase().normalize("NFD").replace(MARCAS, "");
    return n.length === 1 ? n : "?";
  }).join("");
}

export function normalizar(texto: string): string {
  return normalizarIgualLargo(texto).replace(/ +/g, " ").trim();
}

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, media: 0.5, medio: 0.5,
};

// Palabras de relleno: un fragmento que solo tiene estas no genera línea.
const RELLENO = new Set([
  "hola", "bueno", "listo", "ok", "y", "de", "del", "la", "el", "los", "las", "en", "con", "que", "hay", "a", "al",
  "por", "para", "un", "una", "unos", "unas", "tambien", "mas", "eso", "es", "todo", "creo", "nada", "gracias",
]);

/** Posición del sinónimo como palabra completa en la frase, o -1. */
const posicion = (frase: string, sinonimo: string) => {
  const m = new RegExp(`(^|[^a-z0-9])${sinonimo}(?=[^a-z0-9]|$)`).exec(frase);
  return m ? m.index + m[1].length : -1;
};

/**
 * Partida que nombra la frase. Gana el sinónimo que aparece primero (en "tirar 25 m
 * de cable desde el tablero" el objeto es el cable, no el tablero) y, a igual
 * posición, el más largo ("tubería de cobre" antes que "tubería").
 */
export function buscarPartida(frase: string, partidas: Partida[] = catalogo): Partida | null {
  let mejor: { p: Partida; pos: number; largo: number } | null = null;
  for (const p of partidas) {
    for (const s of p.sinonimos) {
      const pos = posicion(frase, s);
      if (pos < 0) continue;
      if (!mejor || pos < mejor.pos || (pos === mejor.pos && s.length > mejor.largo)) mejor = { p, pos, largo: s.length };
    }
  }
  return mejor?.p ?? null;
}

/** Primera cantidad de la frase: "2", "2,5", "6 m2", "tres". Si no hay, null. */
export function extraerCantidad(frase: string): number | null {
  const cifra = frase.match(/(?:^|[^a-z0-9])(\d+(?:[.,]\d+)?)(?=[^0-9]|$)/);
  if (cifra) return Number(cifra[1].replace(",", "."));
  for (const palabra of frase.split(/[^a-z]+/)) if (palabra in NUMEROS) return NUMEROS[palabra];
  return null;
}

export function extraerUnidad(frase: string): Unidad | null {
  if (/\d\s*m2\b|metros? cuadrados?/.test(frase)) return "m2";
  if (/\d\s*(m|ml|mts?)\b|metros?/.test(frase)) return "m";
  if (/\d\s*h\b|horas?/.test(frase)) return "h";
  return null;
}

const SEPARADOR =
  /[\n.;]+|,\s*|\s+y\s+(?=(?:\d|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cambiar|instalar|colocar|poner|reparar|tirar|pintar|revisar)\b)/g;

export type Frase = { normal: string; original: string };

/**
 * Parte el texto en frases: saltos de línea, puntos, punto y coma, comas y " y " entre
 * acciones. Devuelve cada frase normalizada (para reconocerla) y tal como se escribió.
 */
export function frases(texto: string): Frase[] {
  const fuente = Array.from(texto); // un elemento por carácter, igual que normalizarIgualLargo
  const normal = normalizarIgualLargo(texto);
  const cortes: Frase[] = [];
  let desde = 0;
  const agregar = (hasta: number) => {
    const n = normal.slice(desde, hasta).replace(/ +/g, " ").trim();
    if (n) cortes.push({ normal: n, original: fuente.slice(desde, hasta).join("").replace(/\s+/g, " ").trim() });
  };
  for (const m of normal.matchAll(SEPARADOR)) {
    agregar(m.index);
    desde = m.index + m[0].length;
  }
  agregar(normal.length);
  return cortes;
}

function esRelleno(frase: string): boolean {
  const utiles = frase.split(/[^a-z0-9]+/).filter((w) => w && !RELLENO.has(w));
  return utiles.length < 2;
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Interpretacion = { lineas: Linea[]; reconocidas: number; pendientes: number };

/**
 * Interpreta las notas. `nuevoId` genera ids (inyectable para tests deterministas).
 * Si varias frases piden la misma partida se suman las cantidades.
 */
export function interpretar(texto: string, nuevoId: () => string): Interpretacion {
  const lineas: Linea[] = [];

  for (const { normal: frase, original } of frases(texto)) {
    const partida = buscarPartida(frase);
    if (partida) {
      const cantidad = extraerCantidad(frase) ?? 1;
      const existente = lineas.find((l) => l.partidaId === partida.id);
      if (existente) existente.cantidad += cantidad;
      else lineas.push({ id: nuevoId(), partidaId: partida.id, concepto: partida.nombre, unidad: partida.unidad, cantidad, precioUnitario: partida.precio, origen: "nota" });
    } else if (!esRelleno(frase)) {
      // Se conserva el texto tal como lo escribió el autónomo, con sus tildes.
      lineas.push({ id: nuevoId(), partidaId: null, concepto: capitalizar(original).slice(0, 120), unidad: extraerUnidad(frase) ?? "servicio", cantidad: extraerCantidad(frase) ?? 1, precioUnitario: null, origen: "nota" });
    }
  }

  // Regla del negocio: la visita se cobra una vez por presupuesto.
  const idVisita = condiciones.desplazamiento;
  const visita = catalogo.find((p) => p.id === idVisita);
  if (visita && lineas.length > 0 && !lineas.some((l) => l.partidaId === visita.id)) {
    lineas.unshift({ id: nuevoId(), partidaId: visita.id, concepto: visita.nombre, unidad: visita.unidad, cantidad: 1, precioUnitario: visita.precio, origen: "regla" });
  }
  const visitaLinea = lineas.find((l) => l.partidaId === idVisita);
  if (visitaLinea) visitaLinea.cantidad = 1;

  return {
    lineas,
    reconocidas: lineas.filter((l) => l.partidaId !== null && l.origen === "nota").length,
    pendientes: lineas.filter((l) => l.precioUnitario === null).length,
  };
}
