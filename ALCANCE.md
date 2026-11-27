# Alcance · Presupuestín

## Problema del negocio
Un autónomo de oficios (plomero, electricista, pintor, reformas) visita la obra, toma notas en una libreta o en
audios de WhatsApp y, por la noche, pasa todo a un Word o a una hoja de cálculo para mandar el presupuesto. Tarda
días, los precios cambian de un presupuesto a otro, el cliente lo recibe como foto borrosa y la aceptación queda en un
"ok" perdido en el chat. Cada día de retraso es un trabajo que se lleva otro.

**Promesa**: el presupuesto sale desde la obra en minutos, con los precios de siempre, en un PDF profesional, y el
cliente lo acepta con su firma desde el móvil.

## Usuarios
- **Autónomo** (titular del oficio): crea, ajusta y envía presupuestos desde el móvil. Usa el panel.
- **Cliente final**: recibe un enlace por WhatsApp, revisa, descarga el PDF y firma o rechaza. Sin cuenta ni app.

## Funcionalidades del MVP (esta entrega)
1. **Captura desde la obra**: notas escritas, dictado por voz con el reconocimiento del navegador (sin claves) y
   "audios de ejemplo" que simulan la transcripción de un audio de WhatsApp. Hasta 4 fotos, reducidas en el navegador.
2. **Intérprete de notas** (determinista, sin IA): reconoce partidas del catálogo por sinónimos, cantidades en cifras o
   palabras y unidades (ud., m, m², h). Lo que no reconoce queda como línea **pendiente de precio**; nunca inventa precios.
   Añade la visita/traslado una vez por presupuesto (regla configurable).
3. **Motor de presupuestos**: importes en centavos, descuento con tope, impuesto configurable (IVA 16 % en la demo),
   anticipo, validez, estados borrador → enviado → firmado / rechazado / vencido, reapertura con nueva versión.
4. **PDF** con pdf-lib: cabecera del autónomo, cliente, tabla, totales, condiciones, fotos de la obra y bloque de aceptación
   con huella SHA-256 del contenido aceptado. Paginación automática.
5. **Envío por WhatsApp uno a uno**: mensaje en español neutro + enlace wa.me que abre el autónomo en su teléfono.
6. **Firma del cliente**: página móvil con el resumen, descarga del PDF, nombre + firma con el dedo (opcional) +
   casilla de aceptación. La firma solo vale si la huella coincide con lo que el cliente vio.
7. **Momento wow**: el panel del autónomo se actualiza solo y "sella" el presupuesto como FIRMADO en cuanto el cliente firma.

## Fase 2 (fuera de esta entrega)
- IA opcional: transcripción de audios reales (Whisper o similar) y lectura de fotos para sugerir partidas con un modelo
  (AI SDK, mismo patrón que Recepción 24/7). El intérprete por reglas seguiría siendo la base y el respaldo sin claves.
- Cobro del anticipo con Mercado Pago (módulo de la Fábrica) al firmar.
- WhatsApp Cloud API para recibir los audios directamente y avisar al autónomo cuando el cliente firma.
- Facturación electrónica: CFDI (México) y ARCA (Argentina) al terminar el trabajo.
- Supabase (presupuestos + bucket privado de fotos), autenticación del autónomo y multiempresa.
- Catálogo editable desde el panel e historial de precios.
- Integración con Radar Pyme: convertir una `EntradaPresupuesto` (horas por módulo) en un presupuesto de Jorge.

## Criterios de aceptación
- [x] Con las notas de ejemplo se arma un presupuesto con las partidas y cantidades correctas (test).
- [x] Una línea sin precio en el catálogo queda pendiente y bloquea el envío hasta que el autónomo la completa (test).
- [x] Los totales cuadran al centavo: subtotal − descuento + impuesto = total; anticipo + resto = total (test).
- [x] El cliente solo accede con su token; un token falso o de una versión anterior devuelve 404 (test).
- [x] Si el presupuesto cambia después de que el cliente lo abrió, la firma se rechaza (test de huella).
- [x] Un presupuesto vencido o ya firmado no se puede firmar; uno firmado no se reabre (test).
- [x] El PDF se genera con tildes, ñ, m², fotos y varias páginas (test).
- [x] Todo funciona sin ninguna clave. Textos en español neutro (test con el detector de modismos).
- [x] Flujo completo probado en navegador: armar → ajustar precio → enviar → firmar en móvil → el panel se sella solo.

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Validez legal de la firma: es una aceptación electrónica simple, no una firma electrónica avanzada. | Medio | Huella SHA-256, fecha y nombre en el PDF; suficiente para un presupuesto. Para contratos, integrar un proveedor de firma avanzada en fase 2. |
| El intérprete por reglas no entiende frases muy libres. | Medio | Lo no reconocido queda pendiente y visible; nunca se inventa. La IA en fase 2 mejora la cobertura. |
| El dictado depende del navegador (Chrome, Edge, Safari; Firefox no). | Bajo | Se puede escribir o pegar la transcripción. |
| Almacén en memoria: se pierde al reiniciar. | Alto en producción | Es solo para la demo; Supabase antes de cualquier cliente real. |
| Vocabulario de oficios cambia por país ("llave" / "grifo" / "canilla"). | Bajo | Los sinónimos viven en `config.ts`, uno por cliente. |

## Estimación
| Bloque | Horas |
|---|---|
| Alcance y configuración | 2 |
| Motor + intérprete + tests | 8 |
| PDF | 4 |
| Panel del autónomo y página del cliente | 8 |
| Seguridad, API y tests de rutas | 4 |
| Auditoría y documentación | 2 |
| **Total MVP demo** | **28 h** |
| Fase 2 (IA, Mercado Pago, Supabase, auth) | +30–40 h |

## Decisiones tomadas en modo desatendido
Jorge pidió no hacer preguntas. Estas son las decisiones y por qué:
1. **Repo vacío**: `DeadY2J/presupuestin` existía sin commits. Para poder abrir un PR hice un commit inicial en `main`
   con solo un README de una línea; todo el trabajo va en el PR.
2. **Autónomo ficticio en México** (Instalaciones Ríos, Guadalajara, MXN, IVA 16 %): México es el mercado más grande de
   la región y el ejemplo de CFDI de la fase 2. Cambiar de país es cambiar `config.ts`.
3. **Sin IA en el MVP**: el intérprete por reglas funciona sin claves, es gratis, testeable y no inventa datos. La IA se
   deja como fase 2 con la misma interfaz.
4. **"Audio" en la demo** = dictado del navegador + audios de ejemplo que se transcriben en pantalla. Transcribir audios
   reales necesita una clave de un servicio de voz.
5. **WhatsApp sin API**: enlace wa.me que abre el autónomo (uno a uno, como en Radar Pyme). La API de Meta queda para la fase 2.
6. **pdf-lib con Helvetica** en lugar de un navegador sin cabeza: funciona en Vercel sin dependencias pesadas.
7. **Un PR para la app** (motor, interfaz, CI, auditoría) y otro aparte para PRESUPUESTO.md y PROSPECCION.md, como pidió Jorge.
