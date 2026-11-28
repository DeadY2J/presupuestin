/**
 * Genera el PDF del presupuesto con pdf-lib (JavaScript puro, sin navegador).
 * Usa Helvetica estándar (WinAnsi): cubre tildes, ñ, ¿ y ¡. Cualquier carácter
 * fuera de esa tabla (emojis, etc.) se elimina antes de escribir.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { condiciones, impuesto, moneda, negocio } from "./config";
import { calcular, estadoEn, formatoDinero, huella } from "./motor";
import { nombresUnidad } from "./formato";
import type { Presupuesto } from "./tipos";

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 48;
const TINTA = rgb(0.09, 0.13, 0.12);
const SUAVE = rgb(0.36, 0.42, 0.4);
const ACENTO = rgb(0.69, 0.33, 0.13); // terracota
const LINEA = rgb(0.85, 0.83, 0.8);
const VERDE = rgb(0.12, 0.42, 0.29);

const UNIDADES = nombresUnidad;

/** Deja solo caracteres que Helvetica WinAnsi puede dibujar. */
export function textoSeguro(s: string): string {
  return Array.from(s.normalize("NFC"))
    .map((c) => (c === "\n" || c === "\t" ? " " : c))
    .filter((c) => {
      const n = c.codePointAt(0)!;
      return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || "€‚„…–—‘’“”•".includes(c);
    })
    .join("");
}

function partirTexto(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const palabras = textoSeguro(texto).split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba;
    else {
      if (actual) lineas.push(actual);
      actual = p;
      while (fuente.widthOfTextAtSize(actual, tam) > ancho && actual.length > 1) {
        let corte = actual.length - 1;
        while (corte > 1 && fuente.widthOfTextAtSize(actual.slice(0, corte), tam) > ancho) corte--;
        lineas.push(actual.slice(0, corte));
        actual = actual.slice(corte);
      }
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [""];
}

const fecha = (iso: string) =>
  new Intl.DateTimeFormat(moneda.locale, { day: "numeric", month: "long", year: "numeric", timeZone: negocio.zonaHoraria }).format(new Date(iso));
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat(moneda.locale, { dateStyle: "long", timeStyle: "short", timeZone: negocio.zonaHoraria }).format(new Date(iso));

export async function generarPdf(p: Presupuesto, ahora: Date = new Date()): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Presupuesto ${p.numero}`);
  doc.setAuthor(negocio.nombre);
  doc.setProducer("Presupuestín");
  doc.setCreator("Presupuestín");
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const t = calcular(p);
  const dinero = (c: number) => textoSeguro(formatoDinero(c, moneda.codigo, moneda.locale));
  const ancho = A4[0] - MARGEN * 2;

  let pagina: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGEN;

  const escribir = (texto: string, x: number, opciones: { tam?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb>; derecha?: boolean } = {}) => {
    const tam = opciones.tam ?? 10;
    const fuente = opciones.fuente ?? normal;
    const s = textoSeguro(texto);
    const xFinal = opciones.derecha ? x - fuente.widthOfTextAtSize(s, tam) : x;
    pagina.drawText(s, { x: xFinal, y, size: tam, font: fuente, color: opciones.color ?? TINTA });
  };
  const asegurar = (alto: number) => {
    if (y - alto < MARGEN + 30) {
      pagina = doc.addPage(A4);
      y = A4[1] - MARGEN;
    }
  };
  const raya = (color = LINEA, grosor = 0.8) => {
    pagina.drawLine({ start: { x: MARGEN, y }, end: { x: A4[0] - MARGEN, y }, thickness: grosor, color });
  };

  // ── Cabecera
  escribir(negocio.nombre, MARGEN, { tam: 20, fuente: negrita });
  escribir("PRESUPUESTO", A4[0] - MARGEN, { tam: 11, fuente: negrita, color: ACENTO, derecha: true });
  y -= 16;
  escribir(`${negocio.oficio} · ${negocio.ciudad}, ${negocio.pais}`, MARGEN, { color: SUAVE });
  escribir(`${p.numero}${p.version > 1 ? ` · versión ${p.version}` : ""}`, A4[0] - MARGEN, { tam: 14, fuente: negrita, derecha: true });
  y -= 13;
  escribir(`${negocio.telefono} · ${negocio.correo}`, MARGEN, { color: SUAVE, tam: 9 });
  escribir(`Fecha: ${fecha(p.enviadoEn ?? p.creadoEn)}`, A4[0] - MARGEN, { tam: 9, color: SUAVE, derecha: true });
  y -= 12;
  escribir(negocio.idRegistro, MARGEN, { color: SUAVE, tam: 9 });
  if (p.venceEn) escribir(`Válido hasta: ${fecha(p.venceEn)}`, A4[0] - MARGEN, { tam: 9, color: SUAVE, derecha: true });
  y -= 18;
  pagina.drawRectangle({ x: MARGEN, y, width: ancho, height: 3, color: ACENTO });
  y -= 24;

  // ── Cliente
  escribir("PARA", MARGEN, { tam: 8, fuente: negrita, color: SUAVE });
  y -= 14;
  escribir(p.cliente.nombre, MARGEN, { tam: 12, fuente: negrita });
  y -= 13;
  const datosCliente = [p.cliente.direccion, p.cliente.telefono].filter(Boolean).join(" · ");
  if (datosCliente) {
    escribir(datosCliente, MARGEN, { color: SUAVE, tam: 9 });
    y -= 13;
  }
  y -= 14;

  // ── Tabla
  const col = { concepto: MARGEN, cantidad: MARGEN + 320, precio: MARGEN + 410, importe: A4[0] - MARGEN };
  const encabezado = () => {
    escribir("CONCEPTO", col.concepto, { tam: 8, fuente: negrita, color: SUAVE });
    escribir("CANTIDAD", col.cantidad, { tam: 8, fuente: negrita, color: SUAVE, derecha: true });
    escribir("PRECIO", col.precio, { tam: 8, fuente: negrita, color: SUAVE, derecha: true });
    escribir("IMPORTE", col.importe, { tam: 8, fuente: negrita, color: SUAVE, derecha: true });
    y -= 8;
    raya(TINTA, 0.6);
    y -= 15;
  };
  encabezado();
  for (const l of t.lineas) {
    const renglones = partirTexto(l.concepto, normal, 10, 250);
    asegurar(renglones.length * 12 + 10);
    if (y === A4[1] - MARGEN) encabezado();
    const cantidad = `${String(l.cantidad).replace(".", ",")} ${UNIDADES[l.unidad]}`;
    escribir(renglones[0], col.concepto);
    escribir(cantidad, col.cantidad, { derecha: true });
    escribir(l.precioUnitario === null ? "Por definir" : dinero(l.precioUnitario), col.precio, { derecha: true, color: l.precioUnitario === null ? ACENTO : TINTA });
    escribir(l.importe === null ? "—" : dinero(l.importe), col.importe, { derecha: true, fuente: negrita });
    for (const r of renglones.slice(1)) {
      y -= 12;
      escribir(r, col.concepto);
    }
    y -= 9;
    raya();
    y -= 15;
  }

  // ── Totales
  asegurar(110);
  const fila = (etiqueta: string, valor: string, destacado = false) => {
    escribir(etiqueta, col.importe - 110, { derecha: true, color: destacado ? TINTA : SUAVE, fuente: destacado ? negrita : normal, tam: destacado ? 12 : 10 });
    escribir(valor, col.importe, { derecha: true, fuente: destacado ? negrita : normal, tam: destacado ? 12 : 10 });
    y -= destacado ? 18 : 14;
  };
  fila("Subtotal", dinero(t.subtotal));
  if (t.descuento > 0) fila(`Descuento (${p.descuentoPct} %)`, `- ${dinero(t.descuento)}`);
  fila(`${impuesto.nombre} (${Math.round(impuesto.tasa * 100)} %)`, dinero(t.impuesto));
  y -= 2;
  fila("Total", dinero(t.total), true);
  fila(`Anticipo al aceptar (${condiciones.anticipoPct} %)`, dinero(t.anticipo));
  fila("Resto al terminar", dinero(t.saldo));
  if (t.pendientes > 0) {
    y -= 4;
    escribir(`Hay ${t.pendientes} concepto(s) por definir: este documento es un borrador y no se puede aceptar todavía.`, MARGEN, { color: ACENTO, tam: 9 });
    y -= 14;
  }
  y -= 10;

  // ── Condiciones
  asegurar(80);
  escribir("CONDICIONES", MARGEN, { tam: 8, fuente: negrita, color: SUAVE });
  y -= 13;
  for (const c of [
    `Válido por ${condiciones.validezDias} días desde su envío.`,
    condiciones.formaDePago,
    condiciones.garantia,
    "Cualquier trabajo adicional no incluido aquí se presupuesta aparte antes de hacerlo.",
  ]) {
    for (const r of partirTexto(`• ${c}`, normal, 9, ancho)) {
      asegurar(12);
      escribir(r, MARGEN, { tam: 9, color: SUAVE });
      y -= 12;
    }
  }
  y -= 10;

  // ── Fotos de la obra
  if (p.fotos.length) {
    const lado = (ancho - 3 * 10) / 4;
    asegurar(lado + 30);
    escribir("FOTOS DE LA OBRA", MARGEN, { tam: 8, fuente: negrita, color: SUAVE });
    y -= 8 + lado;
    let x = MARGEN;
    for (const f of p.fotos) {
      try {
        const img = f.tipo === "png" ? await doc.embedPng(f.datos) : await doc.embedJpg(f.datos);
        const escala = Math.min(lado / img.width, lado / img.height);
        const w = img.width * escala;
        const h = img.height * escala;
        pagina.drawImage(img, { x: x + (lado - w) / 2, y: y + (lado - h) / 2, width: w, height: h });
      } catch {
        // Imagen dañada: se omite sin romper el documento.
      }
      x += lado + 10;
    }
    y -= 20;
  }

  // ── Aceptación
  asegurar(110);
  const estado = estadoEn(p, ahora);
  raya(TINTA, 0.6);
  y -= 16;
  escribir("ACEPTACIÓN DEL CLIENTE", MARGEN, { tam: 8, fuente: negrita, color: SUAVE });
  y -= 16;
  if (estado === "firmado" && p.firma) {
    escribir(`Aceptado por ${p.firma.nombre}`, MARGEN, { fuente: negrita, color: VERDE, tam: 12 });
    y -= 14;
    escribir(`El ${fechaHora(p.firma.fecha)}, desde el enlace personal enviado por WhatsApp.`, MARGEN, { tam: 9, color: SUAVE });
    y -= 12;
    escribir(`Huella del documento aceptado (SHA-256): ${p.firma.huella.slice(0, 32)}…`, MARGEN, { tam: 7.5, color: SUAVE });
    if (p.firma.trazoPng) {
      try {
        const png = await doc.embedPng(Buffer.from(p.firma.trazoPng.split(",")[1], "base64"));
        const h = 50;
        const w = Math.min((png.width / png.height) * h, 200);
        pagina.drawImage(png, { x: A4[0] - MARGEN - w, y: y - 4, width: w, height: h });
      } catch {
        // Trazo dañado: la aceptación por nombre sigue siendo válida.
      }
    }
  } else if (estado === "rechazado") {
    escribir("El cliente rechazó este presupuesto.", MARGEN, { color: ACENTO });
  } else if (estado === "vencido") {
    escribir("Presupuesto vencido sin respuesta.", MARGEN, { color: ACENTO });
  } else {
    escribir("Pendiente de aceptación. El cliente lo firma desde su enlace personal.", MARGEN, { color: SUAVE });
    y -= 12;
    escribir(`Huella del documento (SHA-256): ${huella(p).slice(0, 32)}…`, MARGEN, { tam: 7.5, color: SUAVE });
  }

  // ── Pie en todas las páginas
  const paginas = doc.getPages();
  paginas.forEach((pg, i) => {
    const pie = textoSeguro(`${negocio.nombre} · ${p.numero} · Página ${i + 1} de ${paginas.length} · Esto es un presupuesto, no una factura.`);
    pg.drawText(pie, { x: MARGEN, y: MARGEN - 18, size: 7.5, font: normal, color: SUAVE });
  });

  return doc.save();
}
