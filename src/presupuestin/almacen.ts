/**
 * Almacén en memoria para la demo. Para producción se sustituye por Supabase
 * (tabla presupuestos + bucket privado de fotos) sin tocar el motor.
 */
import type { Presupuesto } from "./tipos";

export class Almacen {
  private datos = new Map<string, Presupuesto>();
  private contador = 0;

  siguienteNumero(ahora: Date): string {
    this.contador += 1;
    return `P-${ahora.getFullYear()}-${String(this.contador).padStart(4, "0")}`;
  }

  guardar(p: Presupuesto): Presupuesto {
    this.datos.set(p.id, p);
    return p;
  }

  obtener(id: string): Presupuesto | null {
    return this.datos.get(id) ?? null;
  }

  /** Más recientes primero. */
  listar(): Presupuesto[] {
    return [...this.datos.values()].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  total(): number {
    return this.datos.size;
  }

  vaciar() {
    this.datos.clear();
    this.contador = 0;
  }
}
