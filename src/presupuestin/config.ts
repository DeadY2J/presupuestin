/**
 * Configuración del cliente: lo ÚNICO que cambia para adaptar Presupuestín a
 * otro autónomo (oficio, catálogo de precios, impuestos, condiciones, moneda).
 * El autónomo y su catálogo son ficticios. Los precios están en centavos para
 * no arrastrar errores de coma flotante.
 */
import type { Partida } from "./tipos";

export const negocio = {
  nombre: "Instalaciones Ríos",
  titular: "Andrés Ríos",
  oficio: "Plomería y electricidad",
  ciudad: "Guadalajara",
  pais: "México",
  zonaHoraria: "America/Mexico_City",
  // Número ficticio (rango reservado para ficción): nadie real lo recibe.
  telefono: "+52 33 5555 0142",
  correo: "contacto@instalaciones-rios.example",
  idRegistro: "RFC de ejemplo: XAXX010101000",
};

export const moneda = { codigo: "MXN", locale: "es-MX" };

/** Impuesto que se suma a la base. tasa en tanto por uno (0.16 = 16 %). */
export const impuesto = { nombre: "IVA", tasa: 0.16 };

export const condiciones = {
  /** Porcentaje del total que se cobra como anticipo al aceptar. */
  anticipoPct: 50,
  /** Días que el presupuesto es válido desde que se envía. */
  validezDias: 15,
  /** Descuento máximo que el autónomo puede aplicar desde el panel. */
  descuentoMaxPct: 20,
  /** Si existe, se añade una vez a cada presupuesto (visita y traslado a la obra). */
  desplazamiento: "visita" as string | null,
  formaDePago: "Transferencia o efectivo. El anticipo se paga al aceptar y el resto al terminar el trabajo.",
  garantia: "Garantía de 90 días sobre la mano de obra.",
};

/** Límites de entrada (seguridad y tamaño del PDF). */
export const limites = {
  lineas: 40,
  cantidadMax: 10_000,
  precioMax: 50_000_000, // 500 000,00 por unidad
  fotos: 4,
  bytesFoto: 1_500_000,
  bytesTrazo: 200_000,
  caracteresNotas: 4_000,
};

/**
 * Catálogo de partidas. `sinonimos` son las palabras con las que el autónomo
 * las nombra en sus notas o audios (sin tildes, en minúsculas). El intérprete
 * elige la coincidencia más larga.
 */
export const catalogo: Partida[] = [
  { id: "visita", nombre: "Visita y traslado a la obra", unidad: "servicio", precio: 35_000, sinonimos: ["visita", "traslado", "desplazamiento"] },
  { id: "mano-obra", nombre: "Mano de obra", unidad: "h", precio: 32_000, sinonimos: ["mano de obra", "horas de trabajo", "hora de trabajo", "horas"] },
  { id: "grifo", nombre: "Cambio de llave mezcladora", unidad: "ud", precio: 85_000, sinonimos: ["llave mezcladora", "mezcladora", "llaves", "llave", "grifos", "grifo"] },
  { id: "sifon", nombre: "Cambio de sifón o desagüe", unidad: "ud", precio: 42_000, sinonimos: ["sifon", "desague", "coladera"] },
  { id: "wc", nombre: "Instalación de inodoro", unidad: "ud", precio: 120_000, sinonimos: ["inodoro", "excusado", "taza de bano", "wc"] },
  { id: "fuga", nombre: "Reparación de fuga", unidad: "ud", precio: 65_000, sinonimos: ["fugas", "fuga", "goteo"] },
  { id: "tuberia", nombre: "Tubería de cobre instalada", unidad: "m", precio: 28_000, sinonimos: ["tuberia de cobre", "tubo de cobre", "tuberia", "tubo", "tubos"] },
  { id: "boiler", nombre: "Instalación de calentador de agua", unidad: "ud", precio: 180_000, sinonimos: ["calentador", "boiler", "termotanque", "calefon"] },
  { id: "azulejo", nombre: "Colocación de azulejo", unidad: "m2", precio: 38_000, sinonimos: ["azulejos", "azulejo", "loseta", "ceramica", "alicatado"] },
  { id: "contacto", nombre: "Instalación de contacto eléctrico", unidad: "ud", precio: 45_000, sinonimos: ["contactos", "contacto", "enchufes", "enchufe", "tomacorrientes", "tomacorriente"] },
  { id: "apagador", nombre: "Instalación de apagador", unidad: "ud", precio: 38_000, sinonimos: ["apagadores", "apagador", "interruptores", "interruptor"] },
  { id: "luminaria", nombre: "Instalación de luminaria", unidad: "ud", precio: 52_000, sinonimos: ["luminarias", "luminaria", "lamparas", "lampara", "focos", "foco"] },
  { id: "cableado", nombre: "Cableado eléctrico", unidad: "m", precio: 9_500, sinonimos: ["cableado", "cable"] },
  { id: "tablero", nombre: "Cambio de centro de carga", unidad: "ud", precio: 260_000, sinonimos: ["centro de carga", "tablero electrico", "tablero", "pastillas"] },
  { id: "pintura", nombre: "Pintura de muro", unidad: "m2", precio: 9_000, sinonimos: ["pintar", "pintura"] },
];

/** Notas de ejemplo que simulan la transcripción de un audio enviado desde la obra. */
export const audiosDeEjemplo = [
  {
    titulo: "Baño de la familia Gómez",
    cliente: { nombre: "Laura Gómez", telefono: "+52 33 5555 0187", direccion: "Calle Morelos 214, Guadalajara" },
    notas:
      "Hay que cambiar 2 llaves mezcladoras del lavabo y la regadera. Reparar la fuga debajo del lavabo. " +
      "Colocar 6 metros cuadrados de azulejo en la pared de la regadera. Unas 3 horas de mano de obra. " +
      "Revisar humedad en el techo del cuarto de al lado.",
  },
  {
    titulo: "Cocina del departamento 3B",
    cliente: { nombre: "Martín Herrera", telefono: "+52 33 5555 0163", direccion: "Av. Chapultepec 980, depto. 3B" },
    notas:
      "Instalar 4 contactos nuevos en la cocina y 3 luminarias LED. Tirar 25 metros de cable desde el tablero. " +
      "Cambiar el centro de carga porque está viejo. 5 horas de trabajo.",
  },
];
