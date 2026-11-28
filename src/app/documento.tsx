/** Piezas visuales del documento compartidas por el panel y la página del cliente. */

const fechaSello = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");

/** Sello rojo «Aprobado». `cae` lo anima al estamparse (solo la primera vez). */
export function Sello({ nombre, fecha, locale, cae, className = "" }: { nombre: string; fecha: string; locale: string; cae: boolean; className?: string }) {
  return (
    <div className={`sello ${cae ? "cae" : ""} pointer-events-none select-none px-4 pb-2 pt-3 text-center ${className}`} aria-hidden>
      <p className="sello-texto text-[2.6rem] uppercase sm:text-5xl">Aprobado</p>
      <p className="mt-1.5 border-t-2 border-current pt-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em]">{fechaSello(fecha, locale)}</p>
      <p className="max-w-48 truncate text-xs font-medium">{nombre}</p>
    </div>
  );
}

const pasos = [
  { id: "borrador", texto: "Borrador" },
  { id: "enviado", texto: "Enviado al cliente" },
  { id: "firmado", texto: "Aprobado" },
] as const;

/** Recorrido del documento en el margen superior: dónde está este presupuesto. */
export function Recorrido({ estado }: { estado: "borrador" | "enviado" | "firmado" | "rechazado" | "vencido" | "vivo" }) {
  const indice = estado === "firmado" ? 2 : estado === "enviado" || estado === "rechazado" || estado === "vencido" ? 1 : 0;
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-grafito" aria-label="Estado del presupuesto">
      {pasos.map((p, i) => {
        const hecho = i < indice;
        const actual = i === indice;
        return (
          <li key={p.id} className="flex items-center gap-2" aria-current={actual ? "step" : undefined}>
            {i > 0 && <span aria-hidden className={`h-px w-5 ${i <= indice ? "bg-tinta" : "bg-regla"}`} />}
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full border ${
                actual ? (p.id === "firmado" ? "border-sello bg-sello" : "border-tinta bg-tinta") : hecho ? "border-tinta bg-tinta" : "border-grafito"
              }`}
            />
            <span className={actual ? "font-semibold text-noche" : ""}>{p.texto}</span>
          </li>
        );
      })}
    </ol>
  );
}
