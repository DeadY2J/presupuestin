# Fábrica · Presupuestín

Proyecto de Jorge Lamelas: cuarta demo de la Fábrica de software para pymes de Latinoamérica.
Para autónomos de oficios (plomería, electricidad, reformas): de las notas, audios y fotos de la obra a un
presupuesto en PDF que el cliente revisa y firma desde un enlace enviado por WhatsApp. Alcance en `ALCANCE.md`.

## Comandos
- `npm run dev`: servidor en http://localhost:3000 (sin claves funciona el modo demo).
- `npm test`: tests (Vitest). Deben pasar siempre antes de commitear.
- `npm run typecheck` y `npm run build`: los ejecuta también la CI.

## Arquitectura (respétala)
- `src/presupuestin/config.ts`: lo ÚNICO que cambia por cliente (oficio, catálogo con sinónimos, impuesto, moneda, condiciones).
- `src/presupuestin/motor.ts`: cálculo en centavos y ciclo de vida (borrador → enviado → firmado/rechazado/vencido). Puro y testeable.
- `src/presupuestin/interprete.ts`: notas de obra → líneas del catálogo. Determinista, sin IA. Lo que no reconoce queda
  "pendiente de precio": nunca inventa precios.
- `src/presupuestin/pdf.ts` (pdf-lib), `whatsapp.ts` (mensaje + enlace wa.me, envío manual), `servicio.ts` (casos de uso y vistas).
- `src/presupuestin/seguridad.ts`: clave del panel (PRESUPUESTIN_TOKEN), token por presupuesto para el cliente, límites, validación de imágenes.
- `src/presupuestin/almacen.ts`: en memoria. Para producción se sustituye por Supabase sin tocar el motor.
- `src/app/`: panel del autónomo (`taller.tsx`), página del cliente (`firma/[id]`) y rutas API.

## Convenciones
- Código y comentarios en español. Todos los textos visibles en español latinoamericano neutro con tuteo: sin voseo ni
  modismos regionales ("cita", no "turno"; "anticipo", no "seña"). El catálogo puede usar el vocabulario del país del cliente.
- Toda regla de negocio nueva va en el motor con su test, no en la UI.
- El cliente solo accede a SU presupuesto con su token; la vista del cliente nunca expone notas internas ni otros clientes.
- Importes siempre en centavos enteros. Nada de coma flotante para dinero.
- WhatsApp: el envío lo hace el autónomo a mano desde su teléfono. Nada de envíos automáticos ni masivos.
