# Estado · Presupuestín (28/11/2026)

## Modo presentación (28/11/2026, PR de prioridad 2)
- Botón «Modo presentación» (solo en modo demo): ejecuta el guion de 60 s de PROSPECCION.md con subtítulos, contador y
  barra de progreso. Reinicia la demo, reproduce el audio del baño, pone precio a la línea marcada, envía, simula el
  móvil del cliente (la firma pasa por la ruta real del cliente con su token) y cae el sello «Aprobado».
- «Detener», «Reiniciar» y «Repetir». Mientras corre, el resto del panel queda inerte para no interferir.
- Guion como datos en `src/presupuestin/guion.ts`, con test (orden, 60 s, línea sin precio, español neutro): 46 tests.

## Rediseño visual (28/11/2026, PR de prioridad 1)
- Identidad propia: documento formal en blanco frío, tinta azul (#1D3F95) y un único rojo para el sello «Aprobado» (#C3202E).
  Tipografías Archivo (interfaz) y Newsreader (documento), alojadas en el proyecto (OFL).
- La hoja del presupuesto se escribe en vivo mientras se dicta o se reproduce un audio de ejemplo (el intérprete corre
  también en el navegador; el servidor sigue siendo quien guarda y calcula).
- Al aprobarse, el sello rojo cae sobre la hoja (panel y página del cliente). Respeta `prefers-reduced-motion`.
- El estado «firmado» se muestra como «Aprobado». El PDF usa los mismos colores.
- Verificado: typecheck, 43 tests y build en verde; sin errores de consola con la CSP; sin desbordamiento a 375 px.

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
