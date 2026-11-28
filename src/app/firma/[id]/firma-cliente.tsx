"use client";

import { useEffect, useRef, useState } from "react";
import { formatoDinero, nombresUnidad } from "@/presupuestin/formato";
import type { VistaCliente } from "@/presupuestin/servicio";

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
      ctx.strokeStyle = "#1d211f";
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
        className="h-36 w-full touch-none rounded-xl border-2 border-dashed border-borde bg-white"
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
        className="mt-1 text-sm text-tinta-suave underline"
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
        {error ? <p role="alert" className="rounded-xl bg-[#f3dcd3] px-4 py-3 text-alerta">{error}</p> : <p className="text-tinta-suave">Cargando tu presupuesto…</p>}
      </main>
    );
  }

  const dinero = (c: number) => formatoDinero(c, p.moneda.codigo, p.moneda.locale);
  const t = p.totales;
  const pdf = `/api/presupuestos/${encodeURIComponent(id)}/pdf?t=${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <header className="py-6">
        <p className="text-sm font-semibold tracking-wide text-terracota">PRESUPUESTO {p.numero}</p>
        <h1 className="text-2xl font-bold">{p.negocio.nombre}</h1>
        <p className="text-sm text-tinta-suave">{p.negocio.oficio} · {p.negocio.ciudad} · {p.negocio.telefono}</p>
      </header>

      <section className="relative rounded-2xl border border-borde bg-tarjeta p-4 sm:p-6">
        {p.estado === "firmado" && (
          <div className={`${recienFirmado ? "sello" : ""} absolute right-4 top-4 -rotate-6 rounded-xl border-4 border-verde px-3 py-1 text-center text-verde`} aria-hidden>
            <p className="text-lg font-extrabold tracking-wider">ACEPTADO</p>
          </div>
        )}
        <p className="text-sm text-tinta-suave">Para</p>
        <p className="font-semibold">{p.cliente.nombre}</p>
        {p.cliente.direccion && <p className="text-sm text-tinta-suave">{p.cliente.direccion}</p>}

        <ul className="mt-5 divide-y divide-borde border-y border-borde">
          {t.lineas.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
              <span className="min-w-0">
                {l.concepto}
                <span className="block text-xs text-tinta-suave">
                  {String(l.cantidad).replace(".", ",")} {nombresUnidad[l.unidad]} × {l.precioUnitario === null ? "por definir" : dinero(l.precioUnitario)}
                </span>
              </span>
              <span className="cifra shrink-0 font-semibold">{l.importe === null ? "—" : dinero(l.importe)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-tinta-suave">Subtotal</dt><dd className="cifra">{dinero(t.subtotal)}</dd></div>
          {t.descuento > 0 && <div className="flex justify-between"><dt className="text-tinta-suave">Descuento ({p.descuentoPct} %)</dt><dd className="cifra">- {dinero(t.descuento)}</dd></div>}
          <div className="flex justify-between"><dt className="text-tinta-suave">{p.impuesto.nombre} ({Math.round(p.impuesto.tasa * 100)} %)</dt><dd className="cifra">{dinero(t.impuesto)}</dd></div>
          <div className="flex justify-between border-t border-tinta pt-1 text-xl font-bold"><dt>Total</dt><dd className="cifra">{dinero(t.total)}</dd></div>
          <div className="flex justify-between text-tinta-suave"><dt>Anticipo al aceptar ({p.condiciones.anticipoPct} %)</dt><dd className="cifra">{dinero(t.anticipo)}</dd></div>
        </dl>

        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-tinta-suave">
          {p.venceEn && <li>Válido hasta el {fechaLarga(p.venceEn, p.moneda.locale)}.</li>}
          <li>{p.condiciones.formaDePago}</li>
          <li>{p.condiciones.garantia}</li>
        </ul>

        <a href={pdf} target="_blank" rel="noopener" className="mt-5 inline-block rounded-xl border border-borde px-4 py-2 text-sm font-medium hover:bg-papel">
          Descargar PDF{p.fotos ? ` (incluye ${p.fotos} foto${p.fotos > 1 ? "s" : ""})` : ""}
        </a>
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl bg-[#f3dcd3] px-4 py-3 text-sm text-alerta">{error}</p>}

      {p.estado === "enviado" && !rechazando && (
        <form
          className="mt-6 rounded-2xl border border-borde bg-tarjeta p-4 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            responder({ accion: "firmar", nombre, huella: p.huella, trazo, acepto: true });
          }}
        >
          <h2 className="text-lg font-bold">Aceptar el presupuesto</h2>
          <label className="mt-3 block text-sm">
            <span className="font-medium">Tu nombre completo</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={3} maxLength={80} autoComplete="name" className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2" />
          </label>
          <p className="mt-3 text-sm font-medium">Firma con el dedo <span className="font-normal text-tinta-suave">(opcional)</span></p>
          <div className="mt-1">
            <Lienzo onCambio={setTrazo} />
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1" />
            <span>Leí el presupuesto {p.numero} por {dinero(t.total)} y lo acepto, con el anticipo del {p.condiciones.anticipoPct} %.</span>
          </label>
          <button disabled={!acepto || nombre.trim().length < 3 || enviando} className="mt-4 w-full rounded-xl bg-verde px-4 py-3 font-semibold text-white disabled:opacity-50">
            {enviando ? "Enviando…" : "Firmar y aceptar"}
          </button>
          <button type="button" onClick={() => setRechazando(true)} className="mt-3 w-full text-sm text-tinta-suave underline">
            No me interesa o quiero cambios
          </button>
        </form>
      )}

      {p.estado === "enviado" && rechazando && (
        <form
          className="mt-6 rounded-2xl border border-borde bg-tarjeta p-4 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            responder({ accion: "rechazar", motivo });
          }}
        >
          <h2 className="text-lg font-bold">Rechazar el presupuesto</h2>
          <label className="mt-3 block text-sm">
            <span className="font-medium">¿Qué te gustaría cambiar? <span className="font-normal text-tinta-suave">(opcional)</span></span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2" />
          </label>
          <div className="mt-4 flex gap-2">
            <button disabled={enviando} className="flex-1 rounded-xl bg-tinta px-4 py-3 font-semibold text-papel disabled:opacity-50">Enviar respuesta</button>
            <button type="button" onClick={() => setRechazando(false)} className="rounded-xl border border-borde px-4 py-3">Volver</button>
          </div>
        </form>
      )}

      {p.estado === "firmado" && p.firma && (
        <p className="aparece mt-6 rounded-2xl bg-verde-claro px-4 py-4 text-verde" role="status">
          ¡Gracias, {p.firma.nombre.split(" ")[0]}! Aceptaste el presupuesto el {fechaLarga(p.firma.fecha, p.moneda.locale)}. {p.negocio.titular} te escribirá para coordinar el anticipo y la fecha de inicio. Puedes descargar el PDF firmado arriba.
        </p>
      )}
      {p.estado === "rechazado" && (
        <p className="mt-6 rounded-2xl bg-papel px-4 py-4 text-tinta-suave" role="status">Registramos tu respuesta. {p.negocio.titular} podrá enviarte una versión ajustada.</p>
      )}
      {p.estado === "vencido" && (
        <p className="mt-6 rounded-2xl bg-papel px-4 py-4 text-tinta-suave" role="status">Este presupuesto venció. Pide a {p.negocio.titular} que te envíe uno actualizado.</p>
      )}

      <p className="mt-8 text-center text-xs text-tinta-suave">Presupuesto generado con Presupuestín. No es una factura.</p>
    </main>
  );
}
