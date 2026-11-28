/**
 * Guion del modo presentación: los 60 segundos de PROSPECCION.md, paso a paso.
 * Solo datos (textos y tiempos); la interfaz los ejecuta en orden. Así el guion
 * se prueba sin navegador: dura 60 s y está en español neutro.
 */
import { audiosDeEjemplo } from "./config";

export type PasoGuion = {
  id: "dolor" | "obra" | "precio" | "enviar" | "cliente" | "sello";
  /** Segundo en que empieza, contado desde el inicio de la presentación. */
  desde: number;
  titulo: string;
  texto: string;
};

export const DURACION_GUION = 60;

/** Audio de ejemplo que usa la presentación (tiene una línea sin precio a propósito). */
export const ejemploGuion = audiosDeEjemplo[0];

/** Precio que «el autónomo» pone a la línea que no estaba en su lista, en centavos. */
export const precioManualGuion = 45_000;

export const guion: PasoGuion[] = [
  { id: "dolor", desde: 0, titulo: "El problema", texto: "¿Cuánto tardas en pasar a limpio un presupuesto después de la visita? Te lo muestro." },
  { id: "obra", desde: 8, titulo: "Desde la obra", texto: "Llega el audio de la visita y el presupuesto se escribe solo, con tus precios." },
  { id: "precio", desde: 20, titulo: "No inventa nada", texto: "Lo que no está en tu lista queda marcado para que le pongas precio tú." },
  { id: "enviar", desde: 28, titulo: "Enviar", texto: "Un toque y tienes el mensaje con el enlace. Lo mandas tú desde tu teléfono." },
  { id: "cliente", desde: 38, titulo: "El cliente", texto: "En su móvil, el cliente revisa, firma con el dedo y acepta." },
  { id: "sello", desde: 50, titulo: "Aprobado", texto: "Del «¿me mandas el presupuesto?» al «sí» en un minuto. ¿Lo probamos con tus precios?" },
];
