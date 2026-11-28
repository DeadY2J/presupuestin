import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import "./globals.css";

// Archivo (texto e interfaz, con eje de anchura para el sello) y Newsreader (el documento). OFL, alojadas en el proyecto.
const archivo = localFont({
  src: "./fuentes/archivo-latin-standard-normal.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});
const newsreader = localFont({
  src: [
    { path: "./fuentes/newsreader-latin-standard-normal.woff2", style: "normal" },
    { path: "./fuentes/newsreader-latin-standard-italic.woff2", style: "italic" },
  ],
  variable: "--font-newsreader",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Presupuestín",
  description: "De las notas y fotos de la obra a un presupuesto en PDF que tu cliente firma desde WhatsApp.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1d3f95", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render dinámico: la CSP lleva un nonce nuevo en cada petición (ver src/proxy.ts).
  await connection();
  return (
    <html lang="es" className={`${archivo.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
