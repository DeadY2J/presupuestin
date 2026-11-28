/**
 * Casos de uso: une el intérprete, el motor y el almacén. Las rutas API solo
 * validan la entrada, comprueban el acceso y llaman aquí.
 */
import { randomUUID } from "node:crypto";
import { Almacen } from "./almacen";
import { audiosDeEjemplo, condiciones, impuesto, limites, moneda, negocio } from "./config";
import { interpretar } from "./interprete";
import * as motor from "./motor";
import { decodificarImagen, tokenAleatorio } from "./seguridad";
import type { Cliente, Estado, Linea, Presupuesto, Totales } from "./tipos";
import { mensajeEnvio, type MensajeWhatsApp } from "./whatsapp";

export class Servicio {
  constructor(
    readonly almacen: Almacen = new Almacen(),
    private reloj: () => Date = () => new Date(),
    private nuevoId: () => string = () => randomUUID(),
    private nuevoToken: () => string = tokenAleatorio,
  ) {}

  private exigir(id: string): Presupuesto {
    const p = this.almacen.obtener(id);
    if (!p) throw new motor.ErrorPresupuesto("No existe ese presupuesto.");
    return p;
  }

  crear(datos: { cliente: Cliente; notas: string }): Presupuesto {
    const ahora = this.reloj();
    const { lineas } = interpretar(datos.notas, this.nuevoId);
    if (lineas.length > limites.lineas) throw new motor.ErrorPresupuesto(`Máximo ${limites.lineas} líneas por presupuesto.`);
    return this.almacen.guardar({
      id: this.nuevoId(),
      numero: this.almacen.siguienteNumero(ahora),
      version: 1,
      token: this.nuevoToken(),
      estado: "borrador",
      creadoEn: ahora.toISOString(),
      enviadoEn: null,
      venceEn: null,
      cliente: datos.cliente,
      notas: datos.notas,
      lineas,
      descuentoPct: 0,
      fotos: [],
      firma: null,
      rechazo: null,
    });
  }

  actualizar(id: string, cambios: { lineas?: Linea[]; descuentoPct?: number; cliente?: Cliente }): Presupuesto {
    return this.almacen.guardar(motor.editar(this.exigir(id), cambios));
  }

  agregarFoto(id: string, dataUrl: string): Presupuesto {
    const p = this.exigir(id);
    if (p.estado !== "borrador") throw new motor.ErrorPresupuesto("Solo se pueden añadir fotos a un borrador.");
    if (p.fotos.length >= limites.fotos) throw new motor.ErrorPresupuesto(`Máximo ${limites.fotos} fotos por presupuesto.`);
    const img = decodificarImagen(dataUrl, limites.bytesFoto);
    if (!img) throw new motor.ErrorPresupuesto("La foto debe ser JPG o PNG de menos de 1,5 MB.");
    return this.almacen.guardar({ ...p, fotos: [...p.fotos, { id: this.nuevoId(), ...img }] });
  }

  quitarFoto(id: string, fotoId: string): Presupuesto {
    const p = this.exigir(id);
    if (p.estado !== "borrador") throw new motor.ErrorPresupuesto("Solo se pueden quitar fotos de un borrador.");
    return this.almacen.guardar({ ...p, fotos: p.fotos.filter((f) => f.id !== fotoId) });
  }

  enviar(id: string, origen: string, opciones: { demo: boolean }): { presupuesto: Presupuesto; enlaceFirma: string; whatsapp: MensajeWhatsApp } {
    const p = this.almacen.guardar(motor.enviar(this.exigir(id), this.reloj()));
    const enlaceFirma = enlaceDeFirma(p, origen);
    return { presupuesto: p, enlaceFirma, whatsapp: mensajeEnvio(p, enlaceFirma, opciones) };
  }

  reabrir(id: string): Presupuesto {
    return this.almacen.guardar(motor.reabrir(this.exigir(id), this.nuevoToken()));
  }

  /** Presupuesto visible para el cliente solo si el token coincide (y la versión es la vigente). */
  paraCliente(id: string, token: string, comparar: (a: string, b: string) => boolean): Presupuesto | null {
    const p = this.almacen.obtener(id);
    if (!p || !token || !comparar(token, p.token) || p.estado === "borrador") return null;
    return p;
  }

  responder(p: Presupuesto, r: { accion: "firmar"; nombre: string; huella: string; trazo: string | null } | { accion: "rechazar"; motivo: string }): Presupuesto {
    const ahora = this.reloj();
    if (r.accion === "rechazar") return this.almacen.guardar(motor.rechazar(p, r.motivo, ahora));
    let trazoPng: string | null = null;
    if (r.trazo) {
      const img = decodificarImagen(r.trazo, limites.bytesTrazo);
      if (!img || img.tipo !== "png") throw new motor.ErrorPresupuesto("La firma dibujada no es válida. Bórrala y vuelve a firmar.");
      trazoPng = r.trazo;
    }
    return this.almacen.guardar(motor.firmar(p, { nombre: r.nombre, huellaVista: r.huella, trazoPng }, ahora));
  }

  /** Datos de ejemplo: un presupuesto firmado y otro enviado, para que el panel no arranque vacío. */
  sembrar() {
    if (this.almacen.total() > 0) return;
    const ahora = this.reloj();
    const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000);
    const relojOriginal = this.reloj;
    try {
      this.reloj = () => hace(6);
      const a = this.crear({ cliente: audiosDeEjemplo[1].cliente, notas: audiosDeEjemplo[1].notas });
      this.enviar(a.id, "http://localhost", { demo: true });
      this.reloj = () => hace(5);
      const enviado = this.exigir(a.id);
      this.responder(enviado, { accion: "firmar", nombre: audiosDeEjemplo[1].cliente.nombre, huella: motor.huella(enviado), trazo: null });
      this.reloj = () => hace(2);
      const b = this.crear({
        cliente: { nombre: "Sofía Medina", telefono: "+52 33 5555 0121", direccion: "Calle Hidalgo 55, Zapopan" },
        notas: "Instalar calentador de agua nuevo. 4 metros de tubería de cobre. 2 horas de mano de obra.",
      });
      this.enviar(b.id, "http://localhost", { demo: true });
    } finally {
      this.reloj = relojOriginal;
    }
  }
}

export function enlaceDeFirma(p: Presupuesto, origen: string): string {
  return `${origen}/firma/${p.id}?t=${encodeURIComponent(p.token)}`;
}

/* ── Vistas serializables ─────────────────────────────────────────────────── */

export type VistaComun = {
  id: string;
  numero: string;
  version: number;
  estado: Estado;
  creadoEn: string;
  enviadoEn: string | null;
  venceEn: string | null;
  cliente: Cliente;
  totales: Totales;
  descuentoPct: number;
  firma: { nombre: string; fecha: string; huella: string; conTrazo: boolean } | null;
  rechazo: { fecha: string; motivo: string } | null;
};

export type VistaPanel = VistaComun & {
  notas: string;
  fotos: { id: string; tipo: string; bytes: number }[];
  bloqueos: string[];
  enlaceFirma: string | null;
};

export type VistaCliente = VistaComun & {
  huella: string;
  negocio: typeof negocio;
  condiciones: { anticipoPct: number; validezDias: number; formaDePago: string; garantia: string };
  impuesto: typeof impuesto;
  moneda: typeof moneda;
  fotos: number;
};

function comun(p: Presupuesto, ahora: Date): VistaComun {
  return {
    id: p.id,
    numero: p.numero,
    version: p.version,
    estado: motor.estadoEn(p, ahora),
    creadoEn: p.creadoEn,
    enviadoEn: p.enviadoEn,
    venceEn: p.venceEn,
    cliente: p.cliente,
    totales: motor.calcular(p),
    descuentoPct: p.descuentoPct,
    firma: p.firma ? { nombre: p.firma.nombre, fecha: p.firma.fecha, huella: p.firma.huella, conTrazo: !!p.firma.trazoPng } : null,
    rechazo: p.rechazo,
  };
}

export function vistaPanel(p: Presupuesto, origen: string, ahora: Date = new Date()): VistaPanel {
  return {
    ...comun(p, ahora),
    notas: p.notas,
    fotos: p.fotos.map((f) => ({ id: f.id, tipo: f.tipo, bytes: f.datos.length })),
    bloqueos: p.estado === "borrador" ? motor.bloqueosDeEnvio(p) : [],
    enlaceFirma: p.estado === "borrador" ? null : enlaceDeFirma(p, origen),
  };
}

/** Lo que ve el cliente: su presupuesto y nada más (sin notas internas ni otros clientes). */
export function vistaCliente(p: Presupuesto, ahora: Date = new Date()): VistaCliente {
  const { anticipoPct, validezDias, formaDePago, garantia } = condiciones;
  return {
    ...comun(p, ahora),
    huella: motor.huella(p),
    negocio,
    condiciones: { anticipoPct, validezDias, formaDePago, garantia },
    impuesto,
    moneda,
    fotos: p.fotos.length,
  };
}

/* ── Instancia única del servidor (sobrevive a la recarga en caliente) ───── */

const global = globalThis as unknown as { __presupuestin?: Servicio };

export function servicio(): Servicio {
  if (!global.__presupuestin) {
    global.__presupuestin = new Servicio();
    global.__presupuestin.sembrar();
  }
  return global.__presupuestin;
}

export function reiniciarDemo(): Servicio {
  global.__presupuestin = undefined;
  return servicio();
}
