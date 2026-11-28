# Estado · Presupuestín (27/11/2026)

## Revisión del 28/11/2026 (auditoría fase 4)
- CSP completa con nonce por petición (`src/proxy.ts`), verificada en navegador sin errores.
- Typecheck, 43 tests, build y `npm audit` (0 vulnerabilidades) en verde; axe sin incidencias en la vista inicial; sin desbordamiento a 375 px.
- Pendiente con cuentas reales (no se da por bueno): Supabase (RLS por autónomo y bucket privado de fotos), y la fase 2 (IA, Mercado Pago, WhatsApp Cloud API) con cuentas reales.
- Detalle en `AUDITORIA.md`. No desplegado.

## Hecho
- Motor puro en centavos con ciclo de vida completo (borrador, enviado, firmado, rechazado, vencido, reapertura con versión).
- Intérprete de notas por reglas, sin IA, que nunca inventa precios.
- PDF con pdf-lib (fotos, varias páginas, constancia de aceptación con huella SHA-256).
- Panel del autónomo (captura, dictado del navegador, audios de ejemplo, fotos, edición, envío por WhatsApp, actualización en vivo).
- Página de firma del cliente para móvil (firma con el dedo, aceptar o rechazar).
- Seguridad: token por presupuesto, clave opcional del panel, Zod, límites por IP, validación binaria de imágenes, cabeceras.
- 40 tests, typecheck y build en verde. CI en `.github/workflows/ci.yml`. `npm audit` sin vulnerabilidades.
- ALCANCE.md, AUDITORIA.md, README con guion de vídeo de 60 s.

## Pendiente
- No desplegado (por indicación de Jorge). Para Vercel: importar el repo y, si es pública, dejarla en modo demo.
- Fase 2: IA para audios y fotos, Mercado Pago para el anticipo, WhatsApp Cloud API, Supabase y autenticación, CFDI/ARCA.
- Antes de producción: límite de peticiones compartido, Lighthouse en Vercel y prueba en móviles reales (axe ya hecho).
- La CI no se ha visto correr todavía en GitHub Actions (se activa con el PR).

## Cómo probarlo
```bash
npm install && npm run dev   # http://localhost:3000
npm test
```
Flujo: audio de ejemplo → Armar presupuesto → precio a la línea marcada → Guardar → Enviar por WhatsApp →
Abrir como el cliente (demo) → firmar → volver al panel.
