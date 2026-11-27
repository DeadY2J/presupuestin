export type Unidad = "ud" | "m" | "m2" | "h" | "servicio";

export type Partida = {
  id: string;
  nombre: string;
  unidad: Unidad;
  /** Precio por unidad, en centavos, sin impuestos. */
  precio: number;
  sinonimos: string[];
};

export type Linea = {
  id: string;
  partidaId: string | null;
  concepto: string;
  unidad: Unidad;
  cantidad: number;
  /** En centavos. null = pendiente de precio (el motor nunca lo inventa). */
  precioUnitario: number | null;
  origen: "nota" | "manual" | "regla";
};

export type Cliente = { nombre: string; telefono: string; direccion: string };

export type EstadoGuardado = "borrador" | "enviado" | "firmado" | "rechazado";
export type Estado = EstadoGuardado | "vencido";

export type Firma = {
  nombre: string;
  fecha: string;
  /** Huella SHA-256 del contenido que el cliente vio y aceptó. */
  huella: string;
  /** PNG del trazo (opcional): el nombre escrito ya vale como aceptación. */
  trazoPng: string | null;
};

export type Foto = { id: string; tipo: "jpg" | "png"; datos: Uint8Array };

export type Presupuesto = {
  id: string;
  numero: string;
  version: number;
  /** Token del enlace del cliente; cambia en cada versión. */
  token: string;
  estado: EstadoGuardado;
  creadoEn: string;
  enviadoEn: string | null;
  venceEn: string | null;
  cliente: Cliente;
  notas: string;
  lineas: Linea[];
  descuentoPct: number;
  fotos: Foto[];
  firma: Firma | null;
  rechazo: { fecha: string; motivo: string } | null;
};

export type LineaCalculada = Linea & { importe: number | null };

export type Totales = {
  lineas: LineaCalculada[];
  subtotal: number;
  descuento: number;
  base: number;
  impuesto: number;
  total: number;
  anticipo: number;
  saldo: number;
  pendientes: number;
};
