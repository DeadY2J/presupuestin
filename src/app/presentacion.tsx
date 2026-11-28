"use client";

/** Modo presentación: subtítulos del guion de 60 s y el móvil simulado del cliente. */
import { useEffect, useState } from "react";
import { DURACION_GUION, guion } from "@/presupuestin/guion";

export type FaseTelefono = "revisa" | "firma" | "listo";

export function BarraPresentacion(props: { paso: number; inicio: number; fin: boolean; onDetener: () => void; onRepetir: () => void; onReiniciar: () => void }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (props.fin) return;
    const i = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(i);
  }, [props.fin]);

  const segundos = props.fin ? DURACION_GUION : Math.min(DURACION_GUION, Math.max(0, Math.floor((ahora - props.inicio) / 1000)));
  const paso = guion[props.paso];

  return (
    <section aria-label="Modo presentación" className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-tinta bg-noche text-white">
      <div className="h-1 bg-white/15">
        <div className="h-full bg-white transition-[width] duration-300 ease-linear motion-reduce:transition-none" style={{ width: `${(segundos / DURACION_GUION) * 100}%` }} />
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <p className="text-xs text-white/75">
            Paso {props.paso + 1} de {guion.length}: {paso.titulo} <span className="num ml-2">0:{String(segundos).padStart(2, "0")} / 1:00</span>
          </p>
          <p className="serif mt-0.5 text-lg italic leading-snug sm:text-2xl">{paso.texto}</p>
        </div>
        <div className="flex shrink-0 gap-2 text-sm">
          {props.fin ? (
            <>
              <button onClick={props.onRepetir} className="rounded-md bg-white px-3 py-1.5 font-semibold text-noche hover:bg-tinta-clara">Repetir</button>
              <button onClick={props.onReiniciar} className="rounded-md border border-white/50 px-3 py-1.5 hover:border-white">Reiniciar y cerrar</button>
            </>
          ) : (
            <>
              <button onClick={props.onDetener} className="rounded-md border border-white/50 px-3 py-1.5 hover:border-white">Detener</button>
              <button onClick={props.onReiniciar} className="rounded-md border border-white/50 px-3 py-1.5 hover:border-white">Reiniciar</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/** El móvil del cliente durante el paso 5: revisa, escribe su nombre, firma con el dedo y acepta. */
export function TelefonoCliente({ fase, nombre, total, negocio }: { fase: FaseTelefono; nombre: string; total: string; negocio: string }) {
  const [letras, setLetras] = useState(0);
  useEffect(() => {
    if (fase === "revisa") return setLetras(0);
    const i = setInterval(() => setLetras((n) => (n >= nombre.length ? n : n + 1)), 110);
    return () => clearInterval(i);
  }, [fase, nombre]);

  return (
    <div aria-hidden className="fixed bottom-36 right-4 z-30 w-[15.5rem] sm:bottom-32 sm:right-8 lg:right-auto lg:left-[max(2rem,calc(50%-34rem))]">
      <p className="mb-2 text-center text-xs font-medium text-noche">El móvil del cliente</p>
      <div className="rounded-[2rem] border-[7px] border-noche bg-hoja p-4 shadow-[0_30px_60px_-30px_rgb(20_33_61/0.6)]">
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-regla" />
        <p className="text-[0.7rem] text-grafito">{negocio}</p>
        <p className="serif text-xl italic leading-tight text-tinta">Presupuesto</p>
        <p className="mt-1 flex justify-between border-b-2 border-noche pb-1 text-sm">
          <span>Total</span>
          <span className="serif num font-medium text-tinta">{total}</span>
        </p>
        <p className="mt-3 text-[0.7rem] text-grafito">Tu nombre completo</p>
        <p className="min-h-6 border-b border-regla text-sm">{nombre.slice(0, letras)}</p>
        <p className="mt-3 text-[0.7rem] text-grafito">Firma con el dedo</p>
        <svg viewBox="0 0 200 60" className="mt-1 h-14 w-full rounded border border-regla bg-[#fbfcfe]">
          {fase !== "revisa" && (
            <path
              className="trazo-firma"
              d="M10 42 C 22 10, 30 12, 28 40 S 44 50, 52 26 S 62 18, 64 38 C 66 52, 80 30, 92 28 C 104 26, 98 46, 112 40 S 130 18, 138 34 C 144 46, 156 30, 168 30 L 190 26"
              fill="none"
              stroke="#1d3f95"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}
        </svg>
        <p className={`mt-3 rounded-md px-3 py-2 text-center text-sm font-semibold text-white ${fase === "listo" ? "bg-sello" : "bg-tinta"}`}>
          {fase === "listo" ? "Aceptado" : "Firmar y aceptar"}
        </p>
      </div>
    </div>
  );
}
