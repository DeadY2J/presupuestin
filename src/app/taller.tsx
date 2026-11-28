"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatoDinero, nombresEstado, nombresUnidad } from "@/presupuestin/formato";
import { interpretar } from "@/presupuestin/interprete";
import type { VistaPanel } from "@/presupuestin/servicio";
import type { Cliente, Estado, Linea, Unidad } from "@/presupuestin/tipos";
import { Recorrido, Sello } from "./documento";

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

/** Marca de estado en el archivo de presupuestos. El rojo solo para lo aprobado, como el sello. */
const marcaEstado: Record<Estado, string> = {
  borrador: "border-regla text-grafito",
  enviado: "border-tinta text-tinta",
  firmado: "border-sello text-sello",
  rechazado: "border-noche text-noche line-through decoration-1",
  vencido: "border-regla text-grafito",
};

/** Totales en centavos de unas líneas (el servidor recalcula al guardar). */
function calcular(lineas: Linea[], descuentoPct: number, tasa: number) {
  const subtotal = lineas.reduce((s, l) => s + (l.precioUnitario === null ? 0 : Math.round(l.cantidad * l.precioUnitario)), 0);
  const descuento = Math.round((subtotal * descuentoPct) / 100);
  const impuesto = Math.round((subtotal - descuento) * tasa);
  return { subtotal, descuento, impuesto, total: subtotal - descuento + impuesto, pendientes: lineas.filter((l) => l.precioUnitario === null).length };
}

let contadorVivo = 0;
const idVivo = () => `vivo-${++contadorVivo}`;

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
    setActual(null);
    setWhatsapp(null);
    setAviso(null);
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
    setActual(null);
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
      setNotas("");
      setCliente(clienteVacio);
      // En el móvil el presupuesto queda debajo: se lleva la vista hasta él.
      setTimeout(() => document.getElementById("hoja")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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

  function nuevo() {
    setActual(null);
    setWhatsapp(null);
    setAviso(null);
  }

  async function reiniciar() {
    await fetch("/api/demo/reiniciar", { method: "POST" });
    setActual(null);
    setWhatsapp(null);
    setRecienFirmado(null);
    await cargarLista();
  }

  // Mientras se dicta o escribe, la hoja se va escribiendo con lo que el intérprete reconoce.
  const vivas = useMemo(() => (notas.trim() ? interpretar(notas, idVivo).lineas : []), [notas]);
  const enVivo = !actual;
  const lineasHoja = enVivo ? vivas : lineas;
  const t = calcular(lineasHoja, enVivo ? 0 : descuento, props.impuesto.tasa);
  const pendientesLocal = t.pendientes;
  const clienteHoja = enVivo ? cliente : actual.cliente;
  const hoy = new Date().toISOString();
  const locale = moneda.locale;
  const fechaDoc = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });


  const estadoHoja = enVivo ? "vivo" : actual.estado;
  const recienEstampado = !!actual && recienFirmado === actual.id;

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <p className="serif text-2xl font-semibold italic text-tinta">Presupuestín</p>
        {props.demo && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-grafito">Demo con datos ficticios</span>
            <button onClick={reiniciar} className="rounded-md border border-grafito/40 px-3 py-1 text-noche hover:border-tinta hover:text-tinta">Reiniciar demo</button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {pideClave && (
          <form
            className="hoja mb-6 flex flex-wrap items-end gap-3 p-4"
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
            <label htmlFor="clave" className="min-w-0 flex-1 text-sm">
              <span className="text-grafito">Clave de acceso del panel</span>
              <input id="clave" type="password" value={clave} onChange={(e) => setClave(e.target.value)} className="renglon-campo" />
            </label>
            <button className="rounded-md bg-tinta px-4 py-2 font-medium text-white hover:bg-tinta-viva">Entrar</button>
          </form>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10">
          {/* ── Lo que se trae de la obra ── */}
          <section aria-labelledby="t-obra" className="space-y-8 lg:pt-6">
            <div>
              <h1 id="t-obra" className="serif text-[2rem] font-medium leading-tight sm:text-4xl">Dicta la obra. El presupuesto se escribe solo.</h1>
              <p className="mt-2 max-w-md text-grafito">Cada partida que reconoce sale con tu precio. Lo que no está en tu lista queda marcado para que lo pongas tú.</p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-noche">Audios recibidos de la obra</h2>
              <ul className="mt-2 space-y-2">
                {props.ejemplos.map((e) => (
                  <li key={e.titulo}>
                    <button
                      onClick={() => reproducirEjemplo(e)}
                      disabled={!!reproduciendo}
                      className="group flex w-full items-center gap-3 rounded-md border border-regla bg-hoja/60 px-3 py-2 text-left hover:border-tinta disabled:opacity-60"
                    >
                      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tinta text-xs text-white group-hover:bg-tinta-viva">
                        {reproduciendo === e.titulo ? "■" : "▶"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.titulo}</span>
                        <span className="block truncate text-xs text-grafito">{reproduciendo === e.titulo ? "Transcribiendo…" : e.cliente.direccion}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold text-noche">Cliente</legend>
              <label className="text-sm">
                <span className="text-grafito">Nombre</span>
                <input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} maxLength={80} className="renglon-campo" placeholder="Nombre y apellido" autoComplete="off" />
              </label>
              <label className="text-sm">
                <span className="text-grafito">WhatsApp</span>
                <input value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} maxLength={25} inputMode="tel" className="renglon-campo num" placeholder="+52 33 0000 0000" autoComplete="off" />
              </label>
              <label className="text-sm sm:col-span-2 lg:col-span-1 xl:col-span-2">
                <span className="text-grafito">Dirección de la obra</span>
                <input value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} maxLength={160} className="renglon-campo" autoComplete="off" />
              </label>
            </fieldset>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="notas" className="text-sm font-semibold text-noche">Notas de la visita</label>
                <button
                  onClick={dictar}
                  aria-pressed={escuchando}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${escuchando ? "bg-noche text-white" : "border border-grafito/40 hover:border-tinta hover:text-tinta"}`}
                >
                  {escuchando ? <><span aria-hidden className="parpadea mr-1.5 inline-block h-2 w-2 rounded-full bg-white" />Escuchando, toca para parar</> : "Dictar"}
                </button>
              </div>
              <textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={4000}
                rows={6}
                className="mt-2 w-full resize-y rounded-md border border-regla bg-hoja px-3 py-2 leading-relaxed hover:border-grafito focus:border-tinta"
                placeholder="Ej.: cambiar 2 llaves mezcladoras, 6 m2 de azulejo y 3 horas de mano de obra."
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-noche" htmlFor="fotos">Fotos de la obra <span className="font-normal text-grafito">(hasta 4, van en el PDF)</span></label>
              <input id="fotos" type="file" accept="image/jpeg,image/png" capture="environment" multiple onChange={(e) => elegirFotos(e.target.files)} className="mt-2 block w-full text-sm text-grafito file:mr-3 file:rounded-md file:border file:border-grafito/40 file:bg-hoja file:px-3 file:py-1.5 file:text-noche" />
              {fotosPendientes.length > 0 && (
                <div className="mt-3 flex gap-3">
                  {fotosPendientes.map((f, i) => (
                    <button key={i} onClick={() => setFotosPendientes((fs) => fs.filter((_, j) => j !== i))} className="relative bg-hoja p-1 shadow-sm" aria-label={`Quitar foto ${i + 1}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt="" className="h-16 w-16 object-cover" />
                      <span className="absolute -right-1.5 -top-1.5 rounded-full bg-noche px-1.5 text-xs text-white">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={armar} disabled={ocupado || !notas.trim() || !!reproduciendo} className="w-full rounded-md bg-tinta px-4 py-3 text-base font-semibold text-white hover:bg-tinta-viva disabled:opacity-45">
              {ocupado ? "Pasando a limpio…" : "Pasar a limpio el presupuesto"}
            </button>

            {/* Archivo de presupuestos */}
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-noche">Archivo</h2>
                {actual && <button onClick={nuevo} className="text-sm text-tinta underline-offset-2 hover:underline">Empezar uno nuevo</button>}
              </div>
              {lista.length === 0 ? (
                <p className="mt-2 text-sm text-grafito">Todavía no hay presupuestos.</p>
              ) : (
                <ul className="mt-2 border-t border-regla">
                  {lista.map((p) => (
                    <li key={p.id} className="border-b border-regla">
                      <button onClick={() => abrir(p)} aria-current={actual?.id === p.id ? "true" : undefined} className={`flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left hover:bg-hoja/70 ${actual?.id === p.id ? "bg-hoja" : ""}`}>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.cliente.nombre || "Sin nombre"}</span>
                          <span className="num text-xs text-grafito">{p.numero}{p.version > 1 ? `, versión ${p.version}` : ""}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="num text-sm">{dinero(p.totales.total)}</span>
                          <span className={`rounded-[3px] border px-1.5 py-px text-[0.7rem] font-semibold ${marcaEstado[p.estado]}`}>{nombresEstado[p.estado]}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ── La hoja del presupuesto ── */}
          <section id="hoja" aria-labelledby="t-presupuesto" className="scroll-mt-4">
            {aviso && (
              <p role={aviso.tipo === "error" ? "alert" : "status"} className={`mb-3 rounded-md border px-4 py-2.5 text-sm ${aviso.tipo === "error" ? "border-noche bg-hoja text-noche" : "border-tinta/30 bg-tinta-clara text-tinta"}`}>
                {aviso.tipo === "error" && <strong className="font-semibold">No se pudo completar. </strong>}
                {aviso.texto}
              </p>
            )}

            <article key={actual?.id ?? "vivo"} className={`hoja relative px-5 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8 ${recienEstampado ? "golpe" : ""}`}>
              <Recorrido estado={estadoHoja} />

              {/* Membrete */}
              <div className="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b-2 border-noche pb-4">
                <div>
                  <p className="serif text-xl font-semibold leading-tight sm:text-2xl">{props.negocio.nombre}</p>
                  <p className="text-sm text-grafito">{props.negocio.oficio}, {props.negocio.ciudad}</p>
                </div>
                <div className="text-left sm:text-right">
                  <h2 id="t-presupuesto" className="serif text-3xl font-light italic leading-none text-tinta sm:text-4xl">Presupuesto</h2>
                  <p className="num mt-1 text-sm text-grafito" suppressHydrationWarning>
                    {actual ? `${actual.numero}${actual.version > 1 ? `, versión ${actual.version}` : ""}` : "Borrador en vivo"} · {fechaDoc(actual?.creadoEn ?? hoy)}
                  </p>
                </div>
              </div>

              {/* Para */}
              <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-grafito">Para</dt>
                <dd className={clienteHoja.nombre ? "font-medium" : "text-grafito italic"}>{clienteHoja.nombre || "Nombre del cliente"}</dd>
                <dt className="text-grafito">Obra</dt>
                <dd className={clienteHoja.direccion ? "" : "text-grafito italic"}>{clienteHoja.direccion || "Dirección de la obra"}</dd>
              </dl>

              {/* Partidas */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Partidas del presupuesto</caption>
                  <thead>
                    <tr className="border-b border-noche text-left text-xs text-grafito">
                      <th scope="col" className="py-2 font-medium">Concepto</th>
                      <th scope="col" className="w-20 py-2 text-right font-medium sm:w-24">Cantidad</th>
                      <th scope="col" className="w-24 py-2 text-right font-medium sm:w-32">Precio</th>
                      <th scope="col" className="hidden w-28 py-2 text-right font-medium sm:table-cell">Importe</th>
                      {editable && <th className="w-8"><span className="sr-only">Quitar</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lineasHoja.length === 0 && (
                      <>
                        {[0, 1, 2].map((i) => (
                          <tr key={i} className="border-b border-dashed border-regla" aria-hidden={i > 0 ? true : undefined}>
                            <td colSpan={4} className="h-11 text-grafito">{i === 0 ? (reproduciendo || notas.trim() ? "Escuchando la obra…" : "Las partidas aparecerán aquí mientras dictas.") : ""}</td>
                          </tr>
                        ))}
                      </>
                    )}
                    {lineasHoja.map((l, i) => {
                      const pendiente = l.precioUnitario === null;
                      return (
                        <tr key={enVivo ? `${i}-${l.partidaId ?? l.concepto}` : l.id} className={`border-b border-regla align-baseline ${enVivo ? "escribe" : ""}`}>
                          <td className="py-2.5 pr-2 break-words">
                            {editable && l.partidaId === null ? (
                              <input aria-label="Concepto" value={l.concepto} maxLength={120} onChange={(e) => cambiarLinea(l.id, { concepto: e.target.value })} className="celda w-full" />
                            ) : (
                              <span className={pendiente ? "marcador" : ""}>{l.concepto}</span>
                            )}
                            {l.origen === "regla" && <span className="ml-1.5 text-xs text-grafito">se añade siempre</span>}
                            {pendiente && <span className="mt-0.5 block text-xs text-grafito">No está en tu lista de precios: ponlo tú.</span>}
                          </td>
                          <td className="py-2.5 text-right">
                            {editable ? (
                              <span className="inline-flex items-center gap-1">
                                <input aria-label={`Cantidad de ${l.concepto}`} type="number" min={0.01} step={0.01} value={l.cantidad} onChange={(e) => cambiarLinea(l.id, { cantidad: Number(e.target.value) })} className="celda num w-12 text-right sm:w-16" />
                                <span className="text-xs text-grafito">{nombresUnidad[l.unidad]}</span>
                              </span>
                            ) : (
                              <span className="num">{String(l.cantidad).replace(".", ",")} {nombresUnidad[l.unidad]}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            {editable ? (
                              <input
                                aria-label={`Precio de ${l.concepto}`}
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder="Precio"
                                value={pendiente ? "" : l.precioUnitario! / 100}
                                onChange={(e) => cambiarLinea(l.id, { precioUnitario: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })}
                                className={`celda num w-20 text-right sm:w-28 ${pendiente ? "border-noche bg-marcador/40" : ""}`}
                              />
                            ) : (
                              <span className="num">{pendiente ? <span className="marcador">Por definir</span> : dinero(l.precioUnitario!)}</span>
                            )}
                          </td>
                          <td className="num hidden py-2.5 text-right font-medium sm:table-cell"><span>{pendiente ? "—" : dinero(Math.round(l.cantidad * l.precioUnitario!))}</span></td>
                          {editable && (
                            <td className="py-2.5 text-right">
                              <button onClick={() => { setLineas((ls) => ls.filter((x) => x.id !== l.id)); setCambios(true); }} className="rounded px-1.5 text-grafito hover:bg-tinta-clara hover:text-noche" aria-label={`Quitar ${l.concepto}`}>×</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {editable && (
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="w-full min-w-0 text-sm sm:w-auto">
                    <span className="sr-only">Añadir partida</span>
                    <select value="" onChange={(e) => e.target.value && agregarPartida(e.target.value)} className="celda w-full max-w-full py-1.5 sm:w-72">
                      <option value="">+ Añadir partida…</option>
                      {catalogo.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}, {dinero(c.precio)}/{nombresUnidad[c.unidad]}</option>
                      ))}
                      <option value="libre">Concepto libre (sin precio)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-grafito">
                    Descuento
                    <input type="number" min={0} max={props.descuentoMax} value={descuento} onChange={(e) => { setDescuento(Number(e.target.value)); setCambios(true); }} className="celda num w-16 text-right text-noche" />%
                  </label>
                </div>
              )}

              {/* Totales */}
              <dl className="mt-6 ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-grafito">Subtotal</dt><dd className="num">{dinero(t.subtotal)}</dd></div>
                {t.descuento > 0 && <div className="flex justify-between"><dt className="text-grafito">Descuento ({descuento} %)</dt><dd className="num">- {dinero(t.descuento)}</dd></div>}
                <div className="flex justify-between"><dt className="text-grafito">{props.impuesto.nombre} ({Math.round(props.impuesto.tasa * 100)} %)</dt><dd className="num">{dinero(t.impuesto)}</dd></div>
                <div className="flex items-baseline justify-between border-t-2 border-noche pt-2">
                  <dt className="font-semibold">Total</dt>
                  <dd className="serif num text-3xl font-medium text-tinta">{dinero(t.total)}</dd>
                </div>
                {actual && !cambios && <div className="flex justify-between text-grafito"><dt>Anticipo al aceptar</dt><dd className="num">{dinero(actual.totales.anticipo)}</dd></div>}
              </dl>

              {/* Firma */}
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="serif min-h-8 text-xl italic text-tinta">{props.negocio.titular}</p>
                  <p className="border-t border-noche pt-1 text-xs text-grafito">Por {props.negocio.nombre}</p>
                </div>
                <div className="relative">
                  <p className="serif min-h-8 text-xl italic text-tinta">{actual?.firma?.nombre ?? ""}</p>
                  <p className="border-t border-noche pt-1 text-xs text-grafito">
                    {actual?.firma ? `Aceptado el ${new Date(actual.firma.fecha).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" })}` : "Firma del cliente"}
                  </p>
                </div>
              </div>

              {actual?.estado === "firmado" && actual.firma && (
                <Sello nombre={actual.firma.nombre} fecha={actual.firma.fecha} locale={locale} cae={recienEstampado} className="absolute right-3 top-36 sm:right-12 sm:top-32" />
              )}
            </article>

            {/* Lo que pasa con la hoja */}
            {actual && (
              <div className="mt-5 space-y-3">
                {editable && pendientesLocal > 0 && (
                  <p className="text-sm text-noche">
                    <span className="marcador">Pon precio a {pendientesLocal === 1 ? "la línea marcada" : `las ${pendientesLocal} líneas marcadas`}</span> para poder enviarlo. Presupuestín no inventa precios que no están en tu lista.
                  </p>
                )}
                {actual.estado === "rechazado" && actual.rechazo && (
                  <p className="text-sm text-noche">El cliente lo rechazó{actual.rechazo.motivo ? `: «${actual.rechazo.motivo}»` : "."} Puedes reabrirlo, ajustarlo y enviar una nueva versión.</p>
                )}
                {actual.estado === "firmado" && actual.firma && (
                  <p className="text-sm text-noche" role="status">Aprobado por {actual.firma.nombre}. Ya puedes cobrar el anticipo de <span className="num font-semibold">{dinero(actual.totales.anticipo)}</span>.</p>
                )}
                {actual.estado === "enviado" && (
                  <p className="flex items-center gap-2 text-sm text-grafito">
                    <span className="parpadea inline-block h-2 w-2 rounded-full bg-tinta" aria-hidden /> Esperando la firma del cliente. Esta hoja se actualiza sola.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {editable && (
                    <button onClick={() => accion("enviar")} disabled={ocupado || pendientesLocal > 0 || lineas.length === 0} className="rounded-md bg-tinta px-4 py-2.5 font-semibold text-white hover:bg-tinta-viva disabled:opacity-45">
                      Enviar por WhatsApp
                    </button>
                  )}
                  {editable && cambios && (
                    <button onClick={guardar} disabled={ocupado} className="rounded-md border border-tinta px-4 py-2.5 font-medium text-tinta hover:bg-tinta-clara disabled:opacity-45">Guardar cambios</button>
                  )}
                  <a href={`/api/presupuestos/${actual.id}/pdf`} target="_blank" rel="noopener" onClick={(e) => { if (cambios) { e.preventDefault(); setAviso({ tipo: "error", texto: "Guarda los cambios antes de ver el PDF." }); } }} className="rounded-md border border-grafito/40 px-4 py-2.5 font-medium hover:border-tinta hover:text-tinta">
                    Ver PDF
                  </a>
                  {(actual.estado === "enviado" || actual.estado === "rechazado" || actual.estado === "vencido") && (
                    <button onClick={() => accion("reabrir")} disabled={ocupado} className="rounded-md border border-grafito/40 px-4 py-2.5 font-medium hover:border-tinta hover:text-tinta">Reabrir y ajustar</button>
                  )}
                </div>
                {editable && actual.bloqueos.length > 0 && !cambios && pendientesLocal === 0 && (
                  <ul className="text-sm text-noche">{actual.bloqueos.map((b) => <li key={b}>{b}</li>)}</ul>
                )}

                {actual.estado === "enviado" && (whatsapp || actual.enlaceFirma) && (
                  <div className="rounded-md border border-regla bg-hoja/70 p-4">
                    <p className="text-sm font-semibold">Mensaje para {actual.cliente.nombre.split(" ")[0]}</p>
                    {whatsapp && <p className="mt-2 whitespace-pre-line rounded-md border-l-2 border-tinta bg-hoja px-3 py-2 text-sm">{whatsapp.texto}</p>}
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {whatsapp && (
                        <a href={whatsapp.enlace} target="_blank" rel="noopener noreferrer" className="rounded-md bg-tinta px-3 py-1.5 font-medium text-white hover:bg-tinta-viva">Abrir WhatsApp</a>
                      )}
                      {actual.enlaceFirma && (
                        <a href={actual.enlaceFirma} target="_blank" rel="noopener" className="rounded-md border border-tinta px-3 py-1.5 font-medium text-tinta hover:bg-tinta-clara">
                          {props.demo ? "Abrir como el cliente (demo)" : "Abrir enlace del cliente"}
                        </a>
                      )}
                    </div>
                    {props.demo && whatsapp && <p className="mt-2 text-xs text-grafito">En modo demo el enlace de WhatsApp no lleva número: nadie real recibe el mensaje.</p>}
                  </div>
                )}

                {actual.notas && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-grafito">Notas originales de la obra{actual.fotos.length ? `, ${actual.fotos.length} foto(s)` : ""}</summary>
                    <p className="mt-2 rounded-md border border-regla bg-hoja px-3 py-2 leading-relaxed">{actual.notas}</p>
                  </details>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
