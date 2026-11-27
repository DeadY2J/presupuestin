# Estado · Presupuestín (27/11/2026)

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
- Antes de producción: CSP con nonces, límite de peticiones compartido, Lighthouse/axe y prueba en móviles reales.
- La CI no se ha visto correr todavía en GitHub Actions (se activa con el PR).

## Cómo probarlo
```bash
npm install && npm run dev   # http://localhost:3000
npm test
```
Flujo: audio de ejemplo → Armar presupuesto → precio a la línea marcada → Guardar → Enviar por WhatsApp →
Abrir como el cliente (demo) → firmar → volver al panel.
