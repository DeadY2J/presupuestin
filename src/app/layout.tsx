import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Bricolage Grotesque (OFL), alojada en el proyecto: sin dependencia de Google Fonts.
const texto = localFont({
  src: "./fuentes/bricolage-grotesque-latin-opsz-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});
const cifras = localFont({
  src: "./fuentes/bricolage-grotesque-latin-wdth-normal.woff2",
  variable: "--font-cifras",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Presupuestín",
  description: "De las notas y fotos de la obra a un presupuesto en PDF que tu cliente firma desde WhatsApp.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#b0541f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${texto.variable} ${cifras.variable}`}>
      <body>{children}</body>
    </html>
  );
}
