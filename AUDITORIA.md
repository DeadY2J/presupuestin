# Auditoría · Presupuestín

Fecha: 27/11/2026 · Alcance: repositorio `presupuestin` (Next.js 16, almacén en memoria, sin integraciones externas).
Metodología: revisión de código de todas las rutas API y módulos, más comprobaciones ejecutadas (typecheck, tests,
build, `npm audit`, cabeceras con `curl -I` y flujo completo con Playwright en escritorio y en iPhone 13 emulado).

## Resultado

Sin fallos críticos ni altos abiertos. Lo encontrado durante la construcción se corrigió y tiene test. Quedan puntos
medios y bajos documentados abajo, propios de una demo sin base de datos.

## Seguridad

| # | Gravedad | Hallazgo | Estado |
|---|----------|----------|--------|
| S1 | Alta | El enlace del cliente podría permitir ver o firmar presupuestos ajenos si usara ids previsibles. | **Evitado**: id `randomUUID` + token aleatorio de 192 bits por presupuesto, comparado en tiempo constante. Un token falso o de una versión anterior devuelve 404 (tests de servicio y de API). |
| S2 | Alta | El cliente podría firmar un contenido distinto del que vio (el autónomo reabre y cambia cifras). | **Evitado**: la firma exige la huella SHA-256 del contenido visto; al reabrir cambia la versión y el token. Test incluido. |
| S3 | Alta | Panel y API abiertos con datos reales de clientes. | **Mitigado**: con `PRESUPUESTIN_TOKEN` (≥16 caracteres) todo el panel exige `x-presupuestin-token`; si la clave es corta, 503. Sin clave es modo demo con datos ficticios. Tests incluidos. |
| S4 | Media | Subida de archivos maliciosos disfrazados de imagen. | **Corregido**: solo data URL JPEG/PNG, se comprueba la firma binaria real (no el tipo declarado), tope de 1,5 MB por foto, 4 fotos, 200 KB por trazo. Tests incluidos. |
| S5 | Media | Cuerpos JSON enormes para agotar memoria. | **Corregido**: 413 si `content-length` supera 2,5 MB; Zod limita longitudes de todos los campos. Test incluido. |
| S6 | Media | Abuso de las rutas (fuerza bruta de tokens, spam de firmas). | **Corregido**: límites por IP (respuestas del cliente 10/min, vista 60/min, panel 20–240/min). Test incluido. En memoria: con varias instancias hace falta uno compartido (Upstash/Redis). |
| S7 | Media | Cabeceras de seguridad. | **Corregido** en `next.config.ts`: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (micrófono solo propio), HSTS, CSP mínima y sin `X-Powered-By`. Verificado con `curl -I`. La página del cliente usa además `referrer: no-referrer` para no filtrar el token. |
| S8 | Media | CSP completa (script-src/style-src) no aplicada: Next.js necesita nonces. | Abierto, pendiente antes de producción. |
| S9 | Media | En modo demo cualquiera ve la lista y los enlaces de firma de todos los presupuestos. | Aceptado: solo hay datos ficticios y se avisa en la interfaz. No desplegar con clientes reales sin `PRESUPUESTIN_TOKEN`. |
| S10 | Baja | Los errores internos podrían filtrar detalles. | **Corregido**: los errores del motor devuelven 409 con un mensaje para personas; cualquier otro, 500 genérico. |
| S11 | Baja | La aceptación no guarda IP ni agente de usuario como evidencia. | Abierto (mejora de fase 2, con aviso de privacidad). |
| S12 | Baja | Datos en memoria sin persistencia ni cifrado en reposo. | Abierto; se resuelve con Supabase (RLS por autónomo y bucket privado de fotos). |

Comprobado sin hallazgos:
- **Secretos**: ninguno en el código; `.env.example` sin valores; `.gitignore` excluye `.env` y `.env*.local`.
- **Permisos**: la vista del cliente no incluye notas internas, token, trazo ni otros clientes (test).
- **Integridad del dinero**: importes en centavos enteros; precios validados como enteros no negativos con tope (tests).
- **Dependencias**: `npm audit` → 0 vulnerabilidades.

## Calidad

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npm test` | OK · 40 tests (intérprete, motor, servicio, PDF, WhatsApp, API, español neutro) |
| `npm run build` | OK · 2 páginas y 5 rutas API |
| CI | `.github/workflows/ci.yml` (typecheck, test, build) en cada PR. |
| Flujo en navegador | OK con Playwright: armar desde un audio de ejemplo → precio a la línea pendiente → enviar → abrir el enlace en un móvil emulado → firmar con el dedo → el panel se sella solo. Sin errores en consola. |
| Móvil | Panel y página del cliente sin desplazamiento horizontal en iPhone 13 emulado (390 px). Sin probar en dispositivo real. |
| Accesibilidad (revisión de código) | `lang="es"`, etiquetas en todos los campos, `aria-label` en botones de icono y entradas de la tabla, `role="alert"/"status"` en avisos, `aria-pressed` en el dictado, foco visible, animaciones desactivadas con `prefers-reduced-motion`. **No medido** con Lighthouse/axe. |
| Rendimiento | Sin medir con Lighthouse. Fuente local, sin dependencias de terceros en el cliente. El panel consulta el estado cada 3 s solo mientras hay un presupuesto enviado abierto. |
| Textos | Español neutro con tuteo; un test pasa el detector de modismos sobre la interfaz, el PDF, el mensaje de WhatsApp, el catálogo y las condiciones. |

## Pendiente antes de producción real
1. Supabase con RLS y autenticación del autónomo (S12).
2. CSP con nonces (S8) y límite de peticiones compartido (S6).
3. Medir accesibilidad y rendimiento (Lighthouse/axe) y probar en móviles reales.
4. Revisar con un abogado del país el texto de aceptación y la conservación de evidencias (S11).
