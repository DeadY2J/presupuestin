"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatoDinero, nombresEstado, nombresUnidad } from "@/presupuestin/formato";
import type { VistaPanel } from "@/presupuestin/servicio";
import type { Cliente, Estado, Linea, Unidad } from "@/presupuestin/tipos";

type PartidaVisible = { id: string; nombre: string; unidad: Unidad; precio: number };
type Ejemplo = { titulo: string; cliente: Cliente; notas: string };
type WhatsApp = { texto: string; enlace: string; numero: string | null };

type Props = {
  demo: boolean;
  negocio: { nombre: string; titular: string; oficio: string; ciudad: string };
  catalogo: PartidaVisible[];
  ejemplos: Ejemplo[];
  moneda: { codigo: string; locale: string };
  descuentoMax: number;
  impuesto: { nombre: string; tasa: number };
};

const CLAVE_SESION = "presupuestin-clave";
const clienteVacio: Cliente = { nombre: "", telefono: "", direccion: "" };

const colorEstado: Record<Estado, string> = {
  borrador: "bg-borde text-tinta",
  enviado: "bg-terracota-claro text-terracota-oscuro",
  firmado: "bg-verde-claro text-verde",
  rechazado: "bg-[#f3dcd3] text-alerta",
  vencido: "bg-[#ece8e1] text-tinta-suave",
};

/* ── Reconocimiento de voz del navegador (sin claves; Chrome, Edge y Safari) ── */
type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
function crearReconocimiento(): Reconocimiento | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

/** Reduce la foto en el navegador (máx. 1280 px, JPEG) antes de subirla. */
async function reducirFoto(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = mal;
      i.src = url;
    });
    const escala = Math.min(1, 1280 / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Taller(props: Props) {
  const { moneda, catalogo } = props;
  const dinero = (c: number) => formatoDinero(c, moneda.codigo, moneda.locale);

  const [clave, setClave] = useState("");
  const [pideClave, setPideClave] = useState(false);
  const [lista, setLista] = useState<VistaPanel[]>([]);
  const [actual, setActual] = useState<VistaPanel | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [descuento, setDescuento] = useState(0);
  const [cambios, setCambios] = useState(false);
  const [cliente, setCliente] = useState<Cliente>(clienteVacio);
  const [notas, setNotas] = useState("");
  const [fotosPendientes, setFotosPendientes] = useState<string[]>([]);
  const [escuchando, setEscuchando] = useState(false);
  const [reproduciendo, setReproduciendo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsApp | null>(null);
  const [recienFirmado, setRecienFirmado] = useState<string | null>(null);
  const reconocimiento = useRef<Reconocimiento | null>(null);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      setClave(sessionStorage.getItem(CLAVE_SESION) ?? "");
    } catch {
      /* almacenamiento bloqueado: se pide la clave si hace falta */
    }
  }, []);

  const api = useCallback(
    async <T,>(ruta: string, init: RequestInit = {}): Promise<T> => {
      const res = await fetch(ruta, {
        ...init,
        headers: { "Content-Type": "application/json", ...(clave ? { "x-presupuestin-token": clave } : {}), ...init.headers },
      });
      const datos = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 503) setPideClave(true);
      if (!res.ok) throw new Error(datos.error ?? "Algo salió mal.");
      return datos as T;
    },
    [clave],
  );

  const cargarLista = useCallback(async () => {
    try {
      const { presupuestos } = await api<{ presupuestos: VistaPanel[] }>("/api/presupuestos");
      setLista(presupuestos);
    } catch {
      /* el aviso de clave ya se muestra */
    }
  }, [api]);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  const abrir = useCallback((p: VistaPanel) => {
    setActual(p);
    setLineas(p.totales.lineas.map(({ importe: _importe, ...l }) => l));
    setDescuento(p.descuentoPct);
    setCambios(false);
    setWhatsapp(null);
  }, []);

  const refrescarActual = useCallback(
    (p: VistaPanel) => {
      setActual((previo) => {
        if (previo && previo.estado !== "firmado" && p.estado === "firmado") setRecienFirmado(p.id);
        return p;
      });
      setLista((l) => [p, ...l.filter((x) => x.id !== p.id)].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)));
    },
    [],
  );

  // Mientras el presupuesto está enviado, se consulta su estado para ver la firma en vivo.
  useEffect(() => {
    if (!actual || actual.estado !== "enviado") return;
    const id = actual.id;
    const intervalo = setInterval(async () => {
      try {
        const { presupuesto } = await api<{ presupuesto: VistaPanel }>(`/api/presupuestos/${id}`);
        if (presupuesto.estado !== "enviado") refrescarActual(presupuesto);
      } catch {
        /* reintenta en el siguiente ciclo */
      }
    }, 3000);
    return () => clearInterval(intervalo);
  }, [actual, api, refrescarActual]);

  /* ── Captura en la obra ─────────────────────────────────────────── */

  function reproducirEjemplo(e: Ejemplo) {
    if (temporizador.current) clearInterval(temporizador.current);
    setCliente(e.cliente);
    setNotas("");
    setReproduciendo(e.titulo);
    const palabras = e.notas.split(" ");
    let i = 0;
    temporizador.current = setInterval(() => {
      i += 1;
      setNotas(palabras.slice(0, i).join(" "));
      if (i >= palabras.length) {
        clearInterval(temporizador.current!);
        temporizador.current = null;
        setReproduciendo(null);
      }
    }, 45);
  }

  function dictar() {
    if (escuchando) {
      reconocimiento.current?.stop();
      return;
    }
    const r = crearReconocimiento();
    if (!r) {
      setAviso({ tipo: "error", texto: "Tu navegador no permite dictar. Prueba con Chrome o Safari, o escribe las notas." });
      return;
    }
    r.lang = moneda.locale;
    r.continuous = true;
    r.interimResults = false;
    const base = notas.trim();
    let dictado = "";
    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) dictado += ` ${ev.results[i][0].transcript.trim()}.`;
      setNotas(`${base} ${dictado}`.trim());
    };
    r.onend = () => setEscuchando(false);
    r.onerror = () => setEscuchando(false);
    reconocimiento.current = r;
    setEscuchando(true);
    r.start();
  }

  async function elegirFotos(archivos: FileList | null) {
    if (!archivos) return;
    const nuevas: string[] = [];
    for (const a of Array.from(archivos).slice(0, 4 - fotosPendientes.length)) {
      try {
        nuevas.push(await reducirFoto(a));
      } catch {
        setAviso({ tipo: "error", texto: `No pudimos leer la foto ${a.name}.` });
      }
    }
    setFotosPendientes((f) => [...f, ...nuevas].slice(0, 4));
  }

  async function armar() {
    setOcupado(true);
    setAviso(null);
    try {
      const { presupuesto } = await api<{ presupuesto: VistaPanel }>("/api/presupuestos", {
        method: "POST",
        body: JSON.stringify({ cliente, notas }),
      });
      let p = presupuesto;
      for (const imagen of fotosPendientes) {
        p = (await api<{ presupuesto: VistaPanel }>(`/api/presupuestos/${p.id}`, { method: "POST", body: JSON.stringify({ accion: "foto", imagen }) })).presupuesto;
      }
      refrescarActual(p);
      abrir(p);
      setFotosPendientes([]);
      // En el móvil el presupuesto queda debajo: se lleva la vista hasta él.
      setTimeout(() => document.getElementById("presupuesto")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      const pendientes = p.totales.pendientes;
      setAviso({
        tipo: "ok",
        texto: `Presupuesto ${p.numero} armado con ${p.totales.lineas.length} líneas.${pendientes ? ` Revisa ${pendientes === 1 ? "la línea marcada" : `las ${pendientes} líneas marcadas`}: falta el precio.` : ""}`,
      });
    } catch (e) {
      setAviso({ tipo: "error", texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  /* ── Edición del presupuesto ────────────────────────────────────── */

  const editable = actual?.estado === "borrador";

  function cambiarLinea(id: string, cambio: Partial<Linea>) {
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, ...cambio } : l)));
    setCambios(true);
  }

  function agregarPartida(id: string) {
    const nueva: Linea =
      id === "libre"
        ? { id: crypto.randomUUID(), partidaId: null, concepto: "Nuevo concepto", unidad: "ud", cantidad: 1, precioUnitario: null, origen: "manual" }
        : (() => {
            const p = catalogo.find((c) => c.id === id)!;
            return { id: crypto.randomUUID(), partidaId: p.id, concepto: p.nombre, unidad: p.unidad, cantidad: 1, precioUnitario: p.precio, origen: "manual" as const };
          })();
    setLineas((ls) => [...ls, nueva]);
    setCambios(true);
  }

  async function guardar(): Promise<VistaPanel | null> {
    if (!actual) return null;
    setOcupado(true);
    setAviso(null);
    try {
      const { presupuesto } = await api<{ presupuesto: VistaPanel }>(`/api/presupuestos/${actual.id}`, {
        method: "PATCH",
        body: JSON.stringify({ lineas, descuentoPct: descuento }),
      });
      refrescarActual(presupuesto);
      abrir(presupuesto);
      return presupuesto;
    } catch (e) {
      setAviso({ tipo: "error", texto: (e as Error).message });
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function accion(nombre: "enviar" | "reabrir") {
    if (!actual) return;
    if (cambios && !(await guardar())) return;
    setOcupado(true);
    setAviso(null);
    try {
      const r = await api<{ presupuesto: VistaPanel; whatsapp?: WhatsApp }>(`/api/presupuestos/${actual.id}`, {
        method: "POST",
        body: JSON.stringify({ accion: nombre }),
      });
      refrescarActual(r.presupuesto);
      abrir(r.presupuesto);
      if (r.whatsapp) setWhatsapp(r.whatsapp);
    } catch (e) {
      setAviso({ tipo: "error", texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function reiniciar() {
    await fetch("/api/demo/reiniciar", { method: "POST" });
    setActual(null);
    setWhatsapp(null);
    setRecienFirmado(null);
    await cargarLista();
  }

  // Totales locales mientras se edita (el servidor recalcula al guardar).
  const subtotal = lineas.reduce((s, l) => s + (l.precioUnitario === null ? 0 : Math.round(l.cantidad * l.precioUnitario)), 0);
  const desc = Math.round((subtotal * descuento) / 100);
  const imp = Math.round((subtotal - desc) * props.impuesto.tasa);
  const totalLocal = subtotal - desc + imp;
  const pendientesLocal = lineas.filter((l) => l.precioUnitario === null).length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <div>
          <p className="text-sm font-semibold tracking-wide text-terracota">PRESUPUESTÍN</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{props.negocio.nombre}</h1>
          <p className="text-sm text-tinta-suave">{props.negocio.oficio} · {props.negocio.ciudad}</p>
        </div>
        {props.demo && (
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-terracota-claro px-3 py-1 font-medium text-terracota-oscuro">Modo demo · datos ficticios</span>
            <button onClick={reiniciar} className="rounded-full border border-borde px-3 py-1 hover:bg-tarjeta">Reiniciar</button>
          </div>
        )}
      </header>

      {pideClave && (
        <form
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-borde bg-tarjeta p-4"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              sessionStorage.setItem(CLAVE_SESION, clave);
            } catch {
              /* sin almacenamiento: la clave dura hasta recargar */
            }
            setPideClave(false);
            cargarLista();
          }}
        >
          <label htmlFor="clave" className="text-sm font-medium">Clave de acceso del panel</label>
          <input id="clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-borde px-3 py-2" />
          <button className="rounded-lg bg-tinta px-4 py-2 text-papel">Entrar</button>
        </form>
      )}

      {aviso && (
        <p role={aviso.tipo === "error" ? "alert" : "status"} className={`aparece mb-4 rounded-xl px-4 py-3 text-sm ${aviso.tipo === "error" ? "bg-[#f3dcd3] text-alerta" : "bg-verde-claro text-verde"}`}>
          {aviso.texto}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ── Columna 1: desde la obra ── */}
        <section aria-labelledby="t-obra" className="space-y-4">
          <div className="rounded-2xl border border-borde bg-tarjeta p-4 sm:p-5">
            <h2 id="t-obra" className="text-lg font-bold">1. Desde la obra</h2>
            <p className="mt-1 text-sm text-tinta-suave">Dicta o escribe lo que ves. Presupuestín lo convierte en partidas con tus precios.</p>

            <p className="mt-4 text-xs font-semibold tracking-wide text-tinta-suave">AUDIOS DE EJEMPLO</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {props.ejemplos.map((e) => (
                <button key={e.titulo} onClick={() => reproducirEjemplo(e)} disabled={!!reproduciendo} className="flex items-center gap-2 rounded-full bg-terracota-claro px-3 py-1.5 text-sm text-terracota-oscuro hover:bg-[#f0d4c2] disabled:opacity-60">
                  <span aria-hidden>{reproduciendo === e.titulo ? "◼" : "▶"}</span> {e.titulo}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="font-medium">Cliente</span>
                <input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} maxLength={80} className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2" placeholder="Nombre y apellido" />
              </label>
              <label className="text-sm">
                <span className="font-medium">WhatsApp del cliente</span>
                <input value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} maxLength={25} inputMode="tel" className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2" placeholder="+52 33 0000 0000" />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-medium">Dirección de la obra</span>
                <input value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} maxLength={160} className="mt-1 w-full rounded-lg border border-borde bg-white px-3 py-2" />
              </label>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <label htmlFor="notas" className="text-sm font-medium">Notas o audio transcrito</label>
                <button onClick={dictar} className={`rounded-full px-3 py-1 text-sm font-medium ${escuchando ? "grabando bg-alerta text-white" : "border border-borde hover:bg-papel"}`} aria-pressed={escuchando}>
                  {escuchando ? "● Escuchando… toca para parar" : "🎙 Dictar"}
                </button>
              </div>
              <textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={4000} rows={7} className="libreta mt-2 w-full resize-y rounded-lg border border-borde px-3 py-0" placeholder="Ej.: cambiar 2 llaves mezcladoras, 6 m2 de azulejo y 3 horas de mano de obra." />
            </div>

            <div className="mt-3">
              <label className="text-sm font-medium" htmlFor="fotos">Fotos de la obra <span className="font-normal text-tinta-suave">(hasta 4, van en el PDF)</span></label>
              <input id="fotos" type="file" accept="image/jpeg,image/png" capture="environment" multiple onChange={(e) => elegirFotos(e.target.files)} className="mt-2 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-papel file:px-3 file:py-1.5" />
              {fotosPendientes.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {fotosPendientes.map((f, i) => (
                    <button key={i} onClick={() => setFotosPendientes((fs) => fs.filter((_, j) => j !== i))} className="relative" aria-label={`Quitar foto ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt="" className="h-16 w-16 rounded-lg object-cover" />
                      <span className="absolute -right-1 -top-1 rounded-full bg-tinta px-1.5 text-xs text-papel">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={armar} disabled={ocupado || !notas.trim() || !!reproduciendo} className="mt-4 w-full rounded-xl bg-terracota px-4 py-3 font-semibold text-white hover:bg-terracota-oscuro disabled:opacity-50">
              {ocupado ? "Armando…" : "Armar presupuesto"}
            </button>
          </div>

          {/* Historial */}
          <div className="rounded-2xl border border-borde bg-tarjeta p-4 sm:p-5">
            <h2 className="text-lg font-bold">Presupuestos</h2>
            {lista.length === 0 ? (
              <p className="mt-2 text-sm text-tinta-suave">Todavía no hay presupuestos.</p>
            ) : (
              <ul className="mt-2 divide-y divide-borde">
                {lista.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => abrir(p)} className={`flex w-full items-center justify-between gap-3 py-2.5 text-left ${actual?.id === p.id ? "font-semibold" : ""}`}>
                      <span className="min-w-0">
                        <span className="block truncate">{p.cliente.nombre || "Sin nombre"}</span>
                        <span className="text-xs text-tinta-suave">{p.numero}{p.version > 1 ? ` · v${p.version}` : ""}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="cifra text-sm">{dinero(p.totales.total)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${colorEstado[p.estado]}`}>{nombresEstado[p.estado]}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Columna 2: el presupuesto ── */}
        <section id="presupuesto" aria-labelledby="t-presupuesto" className="scroll-mt-4 rounded-2xl border border-borde bg-tarjeta p-4 sm:p-5">
          {!actual ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center text-tinta-suave">
              <h2 id="t-presupuesto" className="text-lg font-bold text-tinta">2. Tu presupuesto</h2>
              <p className="mt-2 max-w-sm text-sm">Toca un audio de ejemplo y luego «Armar presupuesto», o abre uno del historial.</p>
            </div>
          ) : (
            <div className="relative">
              {actual.estado === "firmado" && actual.firma && (
                <div className={`${recienFirmado === actual.id ? "sello" : ""} pointer-events-none absolute right-0 top-10 z-10 -rotate-6 rounded-xl border-4 border-verde bg-tarjeta/90 px-4 py-2 text-center text-verde`} aria-hidden>
                  <p className="text-xl font-extrabold tracking-wider">FIRMADO</p>
                  <p className="text-xs">{actual.firma.nombre}</p>
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 id="t-presupuesto" className="text-lg font-bold">
                    {actual.numero}
                    {actual.version > 1 && <span className="ml-1 text-sm font-normal text-tinta-suave">versión {actual.version}</span>}
                  </h2>
                  <p className="text-sm text-tinta-suave">{actual.cliente.nombre} · {actual.cliente.direccion || "sin dirección"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${colorEstado[actual.estado]}`}>{nombresEstado[actual.estado]}</span>
              </div>

              {/* Líneas */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tinta text-left text-xs tracking-wide text-tinta-suave">
                      <th className="py-2 font-semibold">CONCEPTO</th>
                      <th className="w-20 py-2 text-right font-semibold sm:w-24">CANT.</th>
                      <th className="w-24 py-2 text-right font-semibold sm:w-32">PRECIO</th>
                      <th className="hidden w-28 py-2 text-right font-semibold sm:table-cell">IMPORTE</th>
                      {editable && <th className="w-8"><span className="sr-only">Quitar</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => {
                      const pendiente = l.precioUnitario === null;
                      return (
                        <tr key={l.id} className={`border-b border-borde ${pendiente ? "bg-terracota-claro/60" : ""}`}>
                          <td className="py-2 pr-2 break-words">
                            {editable && l.partidaId === null ? (
                              <input aria-label="Concepto" value={l.concepto} maxLength={120} onChange={(e) => cambiarLinea(l.id, { concepto: e.target.value })} className="w-full rounded border border-borde bg-white px-2 py-1" />
                            ) : (
                              <span>{l.concepto}</span>
                            )}
                            {l.origen === "regla" && <span className="ml-1 text-xs text-tinta-suave">(automático)</span>}
                          </td>
                          <td className="py-2 text-right">
                            {editable ? (
                              <span className="inline-flex items-center gap-1">
                                <input aria-label={`Cantidad de ${l.concepto}`} type="number" min={0.01} step={0.01} value={l.cantidad} onChange={(e) => cambiarLinea(l.id, { cantidad: Number(e.target.value) })} className="cifra w-12 rounded border border-borde bg-white px-1 py-1 text-right sm:w-16" />
                                <span className="text-xs text-tinta-suave">{nombresUnidad[l.unidad]}</span>
                              </span>
                            ) : (
                              <span className="cifra">{String(l.cantidad).replace(".", ",")} {nombresUnidad[l.unidad]}</span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            {editable ? (
                              <input
                                aria-label={`Precio de ${l.concepto}`}
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder="Precio"
                                value={pendiente ? "" : l.precioUnitario! / 100}
                                onChange={(e) => cambiarLinea(l.id, { precioUnitario: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })}
                                className={`cifra w-20 rounded border bg-white sm:w-28 px-1 py-1 text-right ${pendiente ? "border-terracota" : "border-borde"}`}
                              />
                            ) : (
                              <span className="cifra">{pendiente ? "Por definir" : dinero(l.precioUnitario!)}</span>
                            )}
                          </td>
                          <td className="cifra hidden py-2 text-right font-semibold sm:table-cell">{pendiente ? "—" : dinero(Math.round(l.cantidad * l.precioUnitario!))}</td>
                          {editable && (
                            <td className="py-2 text-right">
                              <button onClick={() => { setLineas((ls) => ls.filter((x) => x.id !== l.id)); setCambios(true); }} className="rounded px-1.5 text-tinta-suave hover:bg-papel hover:text-alerta" aria-label={`Quitar ${l.concepto}`}>×</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {editable && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="w-full min-w-0 text-sm sm:w-auto">
                    <span className="sr-only">Añadir partida</span>
                    <select value="" onChange={(e) => e.target.value && agregarPartida(e.target.value)} className="w-full max-w-full rounded-lg border border-borde bg-white px-2 py-1.5 sm:w-72">
                      <option value="">+ Añadir partida…</option>
                      {catalogo.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre} · {dinero(c.precio)}/{nombresUnidad[c.unidad]}</option>
                      ))}
                      <option value="libre">Concepto libre (sin precio)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Descuento
                    <input type="number" min={0} max={props.descuentoMax} value={descuento} onChange={(e) => { setDescuento(Number(e.target.value)); setCambios(true); }} className="cifra w-16 rounded border border-borde bg-white px-1 py-1 text-right" />%
                  </label>
                </div>
              )}

              {/* Totales */}
              <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-tinta-suave">Subtotal</dt><dd className="cifra">{dinero(subtotal)}</dd></div>
                {desc > 0 && <div className="flex justify-between"><dt className="text-tinta-suave">Descuento ({descuento} %)</dt><dd className="cifra">- {dinero(desc)}</dd></div>}
                <div className="flex justify-between"><dt className="text-tinta-suave">{props.impuesto.nombre} ({Math.round(props.impuesto.tasa * 100)} %)</dt><dd className="cifra">{dinero(imp)}</dd></div>
                <div className="flex justify-between border-t border-tinta pt-1 text-lg font-bold"><dt>Total</dt><dd className="cifra">{dinero(totalLocal)}</dd></div>
                {!cambios && <div className="flex justify-between text-tinta-suave"><dt>Anticipo al aceptar</dt><dd className="cifra">{dinero(actual.totales.anticipo)}</dd></div>}
              </dl>

              {editable && pendientesLocal > 0 && (
                <p className="mt-3 rounded-lg bg-terracota-claro px-3 py-2 text-sm text-terracota-oscuro">
                  Pon precio a {pendientesLocal === 1 ? "la línea marcada" : `las ${pendientesLocal} líneas marcadas`} para poder enviarlo. Presupuestín no inventa precios que no están en tu catálogo.
                </p>
              )}
              {actual.estado === "rechazado" && actual.rechazo && (
                <p className="mt-3 rounded-lg bg-[#f3dcd3] px-3 py-2 text-sm text-alerta">El cliente lo rechazó{actual.rechazo.motivo ? `: «${actual.rechazo.motivo}»` : "."} Puedes reabrirlo, ajustarlo y enviar una nueva versión.</p>
              )}
              {actual.estado === "firmado" && actual.firma && (
                <p className="mt-3 rounded-lg bg-verde-claro px-3 py-2 text-sm text-verde">
                  Aceptado por {actual.firma.nombre} ({new Date(actual.firma.fecha).toLocaleString(moneda.locale, { dateStyle: "long", timeStyle: "short" })}). Ya puedes cobrar el anticipo de {dinero(actual.totales.anticipo)}.
                </p>
              )}
              {actual.estado === "enviado" && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-papel px-3 py-2 text-sm text-tinta-suave">
                  <span className="grabando inline-block h-2 w-2 rounded-full bg-terracota" aria-hidden /> Esperando la firma del cliente. Esta pantalla se actualiza sola.
                </p>
              )}

              {/* Acciones */}
              <div className="mt-4 flex flex-wrap gap-2">
                {editable && cambios && (
                  <button onClick={guardar} disabled={ocupado} className="rounded-xl border border-tinta px-4 py-2 font-medium hover:bg-papel disabled:opacity-50">Guardar cambios</button>
                )}
                <a href={`/api/presupuestos/${actual.id}/pdf`} target="_blank" rel="noopener" onClick={(e) => { if (cambios) { e.preventDefault(); setAviso({ tipo: "error", texto: "Guarda los cambios antes de ver el PDF." }); } }} className="rounded-xl border border-borde px-4 py-2 font-medium hover:bg-papel">
                  Ver PDF
                </a>
                {editable && (
                  <button onClick={() => accion("enviar")} disabled={ocupado || pendientesLocal > 0 || lineas.length === 0} className="rounded-xl bg-verde px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50">
                    Enviar por WhatsApp
                  </button>
                )}
                {(actual.estado === "enviado" || actual.estado === "rechazado" || actual.estado === "vencido") && (
                  <button onClick={() => accion("reabrir")} disabled={ocupado} className="rounded-xl border border-borde px-4 py-2 font-medium hover:bg-papel">Reabrir y ajustar</button>
                )}
              </div>
              {editable && actual.bloqueos.length > 0 && !cambios && pendientesLocal === 0 && (
                <ul className="mt-2 text-sm text-alerta">{actual.bloqueos.map((b) => <li key={b}>{b}</li>)}</ul>
              )}

              {/* Envío */}
              {actual.estado === "enviado" && (whatsapp || actual.enlaceFirma) && (
                <div className="aparece mt-5 rounded-xl border border-borde bg-papel p-4">
                  <p className="text-sm font-semibold">Mensaje para {actual.cliente.nombre.split(" ")[0]}</p>
                  {whatsapp && <p className="mt-2 whitespace-pre-line rounded-lg bg-white p-3 text-sm">{whatsapp.texto}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {whatsapp && (
                      <a href={whatsapp.enlace} target="_blank" rel="noopener noreferrer" className="rounded-full bg-verde px-3 py-1.5 font-medium text-white">Abrir WhatsApp</a>
                    )}
                    {actual.enlaceFirma && (
                      <a href={actual.enlaceFirma} target="_blank" rel="noopener" className="rounded-full border border-borde bg-white px-3 py-1.5 font-medium">
                        {props.demo ? "Abrir como el cliente (demo)" : "Abrir enlace del cliente"}
                      </a>
                    )}
                  </div>
                  {props.demo && whatsapp && <p className="mt-2 text-xs text-tinta-suave">En modo demo el enlace de WhatsApp no lleva número: nadie real recibe el mensaje.</p>}
                </div>
              )}

              {actual.notas && (
                <details className="mt-5 text-sm">
                  <summary className="cursor-pointer text-tinta-suave">Notas originales de la obra{actual.fotos.length ? ` · ${actual.fotos.length} foto(s)` : ""}</summary>
                  <p className="libreta mt-2 rounded-lg border border-borde px-3">{actual.notas}</p>
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
