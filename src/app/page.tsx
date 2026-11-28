import { audiosDeEjemplo, catalogo, condiciones, impuesto, moneda, negocio } from "@/presupuestin/config";
import { modoDemo } from "@/presupuestin/seguridad";
import { Taller } from "./taller";

export const dynamic = "force-dynamic";

export default function Inicio() {
  return (
    <Taller
      demo={modoDemo()}
      negocio={negocio}
      catalogo={catalogo.map(({ id, nombre, unidad, precio }) => ({ id, nombre, unidad, precio }))}
      ejemplos={audiosDeEjemplo}
      moneda={moneda}
      descuentoMax={condiciones.descuentoMaxPct}
      impuesto={impuesto}
    />
  );
}
