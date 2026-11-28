"use client";

import { useEffect, useRef, useState } from "react";
import { formatoDinero, nombresUnidad } from "@/presupuestin/formato";
import type { VistaCliente } from "@/presupuestin/servicio";
import { Recorrido, Sello } from "../../documento";

const fechaLarga = (iso: string, locale: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

/** Lienzo para firmar con el dedo o el ratón. Devuelve un PNG o null si está vacío. */
function Lienzo({ onCambio }: { onCambio: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const vacio = useRef(true);

  useEffect(() => {
    const c = ref.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.round(r.width * 2);
      c.height = Math.round(r.height * 2);
      const ctx = c.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1d3f95";
      vacio.current = true;
      onCambio(null);
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [onCambio]);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div>
      <canvas
        ref={ref}
        aria-label="Espacio para dibujar tu firma (opcional)"
        className="h-36 w-full touch-none rounded-md border border-regla bg-[#fbfcfe] [background-image:linear-gradient(transparent_calc(100%-2.25rem),var(--color-noche)_calc(100%-2.25rem),var(--color-noche)_calc(100%-2.25rem+1px),transparent_calc(100%-2.25rem+1px))]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dibujando.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = punto(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!dibujando.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = punto(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          vacio.current = false;
        }}
        onPointerUp={(e) => {
          dibujando.current = false;
          if (!vacio.current) onCambio(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <button
        type="button"
        className="mt-1 text-sm text-grafito underline underline-offset-2 hover:text-tinta"
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          vacio.current = true;
          onCambio(null);
        }}
      >
        Borrar firma
      </button>
    </div>
  );
}

export function FirmaCliente({ id, token }: { id: string; token: string }) {
  const [p, setP] = useState<VistaCliente | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [trazo, setTrazo] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recienFirmado, setRecienFirmado] = useState(false);

  useEffect(() => {
    fetch(`/api/firma/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "No pudimos cargar el presupuesto.");
        setP(d.presupuesto);
      })
      .catch((e: Error) => setError(e.message));
  }, [id, token]);

  async function responder(cuerpo: Record<string, unknown>) {
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/firma/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, t: token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No pudimos registrar tu respuesta.");
      setP(d.presupuesto);
      if (d.presupuesto.estado === "firmado") setRecienFirmado(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!p) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        {error ? <p role="alert" className="hoja px-4 py-3 text-noche">{error}</p> : <p className="text-grafito">Cargando tu presupuesto…</p>}
      </main>
    );
  }

  const dinero = (c: number) => formatoDinero(c, p.moneda.codigo, p.moneda.locale);
  const t = p.totales;
  const pdf = `/api/presupuestos/${encodeURIComponent(id)}/pdf?t=${encodeURIComponent(token)}`;
  const campo = "renglon-campo";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <article className={`hoja relative px-5 pb-8 pt-6 sm:px-10 sm:pt-8 ${recienFirmado ? "golpe" : ""}`}>
        <Recorrido estado={p.estado} />
        <div className="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b-2 border-noche pb-4">
          <div>
            <p className="serif text-xl font-semibold leading-tight sm:text-2xl">{p.negocio.nombre}</p>
            <p className="text-sm text-grafito">{p.negocio.oficio}, {p.negocio.ciudad}</p>
            <p className="num text-sm text-grafito">{p.negocio.telefono}</p>
          </div>
          <div className="sm:text-right">
            <h1 className="serif text-3xl font-light italic leading-none text-tinta sm:text-4xl">Presupuesto</h1>
            <p className="num mt-1 text-sm text-grafito">{p.numero}</p>
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-grafito">Para</dt>
          <dd className="font-medium">{p.cliente.nombre}</dd>
          {p.cliente.direccion && (<><dt className="text-grafito">Obra</dt><dd>{p.cliente.direccion}</dd></>)}
        </dl>

        <ul className="mt-6 border-y border-noche">
          {t.lineas.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-4 border-b border-regla py-2.5 text-sm last:border-b-0">
              <span className="min-w-0">
                {l.concepto}
                <span className="num block text-xs text-grafito">
                  {String(l.cantidad).replace(".", ",")} {nombresUnidad[l.unidad]} × {l.precioUnitario === null ? "por definir" : dinero(l.precioUnitario)}
                </span>
              </span>
              <span className="num shrink-0 font-medium">{l.importe === null ? "—" : dinero(l.importe)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-grafito">Subtotal</dt><dd className="num">{dinero(t.subtotal)}</dd></div>
          {t.descuento > 0 && <div className="flex justify-between"><dt className="text-grafito">Descuento ({p.descuentoPct} %)</dt><dd className="num">- {dinero(t.descuento)}</dd></div>}
          <div className="flex justify-between"><dt className="text-grafito">{p.impuesto.nombre} ({Math.round(p.impuesto.tasa * 100)} %)</dt><dd className="num">{dinero(t.impuesto)}</dd></div>
          <div className="flex items-baseline justify-between border-t-2 border-noche pt-2"><dt className="font-semibold">Total</dt><dd className="serif num text-3xl font-medium text-tinta">{dinero(t.total)}</dd></div>
          <div className="flex justify-between text-grafito"><dt>Anticipo al aceptar ({p.condiciones.anticipoPct} %)</dt><dd className="num">{dinero(t.anticipo)}</dd></div>
        </dl>

        <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-grafito">
          {p.venceEn && <li>Válido hasta el {fechaLarga(p.venceEn, p.moneda.locale)}.</li>}
          <li>{p.condiciones.formaDePago}</li>
          <li>{p.condiciones.garantia}</li>
        </ul>

        {p.firma && (
          <div className="mt-8 max-w-xs">
            <p className="serif text-xl italic text-tinta">{p.firma.nombre}</p>
            <p className="border-t border-noche pt-1 text-xs text-grafito">Aceptado el {fechaLarga(p.firma.fecha, p.moneda.locale)}</p>
          </div>
        )}

        <a href={pdf} target="_blank" rel="noopener" className="mt-6 inline-block rounded-md border border-grafito/40 px-4 py-2 text-sm font-medium hover:border-tinta hover:text-tinta">
          Descargar PDF{p.fotos ? ` (incluye ${p.fotos} foto${p.fotos > 1 ? "s" : ""})` : ""}
        </a>

        {p.estado === "firmado" && p.firma && (
          <Sello nombre={p.firma.nombre} fecha={p.firma.fecha} locale={p.moneda.locale} cae={recienFirmado} className="absolute right-3 top-40 sm:right-12 sm:top-32" />
        )}
      </article>

      {error && <p role="alert" className="mt-4 rounded-md border border-noche bg-hoja px-4 py-3 text-sm text-noche">{error}</p>}

      {p.estado === "enviado" && !rechazando && (
        <form
          className="hoja mt-6 px-5 py-6 sm:px-10"
          onSubmit={(e) => {
            e.preventDefault();
            responder({ accion: "firmar", nombre, huella: p.huella, trazo, acepto: true });
          }}
        >
          <h2 className="serif text-2xl font-medium">Aceptar el presupuesto</h2>
          <label className="mt-4 block text-sm">
            <span className="text-grafito">Tu nombre completo</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} maxLength={80} autoComplete="name" className={campo} />
          </label>
          <p className="mt-5 text-sm text-grafito">Firma con el dedo (opcional)</p>
          <div className="mt-1">
            <Lienzo onCambio={setTrazo} />
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1 accent-[#1d3f95]" />
            <span>Leí el presupuesto {p.numero} por <span className="num">{dinero(t.total)}</span> y lo acepto, con el anticipo del {p.condiciones.anticipoPct} %.</span>
          </label>
          <button disabled={!acepto || nombre.trim().length < 3 || enviando} className="mt-5 w-full rounded-md bg-tinta px-4 py-3 font-semibold text-white hover:bg-tinta-viva disabled:opacity-45">
            {enviando ? "Enviando…" : "Firmar y aceptar"}
          </button>
          <button type="button" onClick={() => setRechazando(true)} className="mt-3 w-full text-sm text-grafito underline underline-offset-2 hover:text-tinta">
            No me interesa o quiero cambios
          </button>
        </form>
      )}

      {p.estado === "enviado" && rechazando && (
        <form
          className="hoja mt-6 px-5 py-6 sm:px-10"
          onSubmit={(e) => {
            e.preventDefault();
            responder({ accion: "rechazar", motivo });
          }}
        >
          <h2 className="serif text-2xl font-medium">Rechazar el presupuesto</h2>
          <label className="mt-4 block text-sm">
            <span className="text-grafito">¿Qué te gustaría cambiar? (opcional)</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-md border border-regla bg-hoja px-3 py-2 focus:border-tinta" />
          </label>
          <div className="mt-4 flex gap-2">
            <button disabled={enviando} className="flex-1 rounded-md bg-noche px-4 py-3 font-semibold text-white disabled:opacity-45">Enviar respuesta</button>
            <button type="button" onClick={() => setRechazando(false)} className="rounded-md border border-grafito/40 px-4 py-3 hover:border-tinta">Volver</button>
          </div>
        </form>
      )}

      {p.estado === "firmado" && p.firma && (
        <p className="mt-6 text-noche" role="status">
          Gracias, {p.firma.nombre.split(" ")[0]}. Aceptaste el presupuesto el {fechaLarga(p.firma.fecha, p.moneda.locale)}. {p.negocio.titular} te escribirá para coordinar el anticipo y la fecha de inicio. Puedes descargar el PDF firmado arriba.
        </p>
      )}
      {p.estado === "rechazado" && (
        <p className="mt-6 text-grafito" role="status">Registramos tu respuesta. {p.negocio.titular} podrá enviarte una versión ajustada.</p>
      )}
      {p.estado === "vencido" && (
        <p className="mt-6 text-grafito" role="status">Este presupuesto venció. Pide a {p.negocio.titular} que te envíe uno actualizado.</p>
      )}

      <p className="mt-10 text-center text-xs text-grafito">Presupuesto generado con Presupuestín. No es una factura.</p>
    </main>
  );
}
