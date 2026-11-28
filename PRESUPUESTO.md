# Presupuesto · Presupuestín (fase 5)

Plantilla para presupuestar Presupuestín a un cliente propio. Las tarifas quedan sin rellenar a propósito:
**[TARIFA_HORA_USD]** y **[CUOTA_MENSUAL_USD]** las fija Jorge en cada caso.
Las horas salen de `ALCANCE.md`; la base ya existe, así que el cliente paga la adaptación, no el desarrollo desde cero.

## 1. Implantación para un autónomo o una empresa pequeña de oficios

| Concepto | Horas | Importe (USD) |
|---|---|---|
| Configuración: datos del negocio, impuesto, moneda, condiciones y logotipo | 2 | 2 × [TARIFA_HORA_USD] |
| Catálogo de partidas y sinónimos del oficio (con el cliente, a partir de 2 o 3 presupuestos reales) | 4 | 4 × [TARIFA_HORA_USD] |
| Persistencia en Supabase y acceso con clave del autónomo | 8 | 8 × [TARIFA_HORA_USD] |
| Despliegue en Vercel con dominio propio y pruebas en su móvil | 3 | 3 × [TARIFA_HORA_USD] |
| Formación (30 min) y ajustes de la primera semana | 3 | 3 × [TARIFA_HORA_USD] |
| **Subtotal implantación** | **20** | **20 × [TARIFA_HORA_USD]** |

## 2. Integraciones opcionales

| Integración | Horas | Importe (USD) | Coste de terceros |
|---|---|---|---|
| Transcripción de audios reales y lectura de fotos con IA | 10 | 10 × [TARIFA_HORA_USD] | Consumo de la API de IA (centavos por presupuesto) |
| Cobro del anticipo con Mercado Pago al firmar | 8 | 8 × [TARIFA_HORA_USD] | Comisión de Mercado Pago por cobro |
| WhatsApp Cloud API (recibir audios y avisar al firmar) | 10 | 10 × [TARIFA_HORA_USD] | Conversaciones de WhatsApp según tarifa de Meta |
| Facturación electrónica (CFDI en México o ARCA en Argentina) | 20–30 | 20–30 × [TARIFA_HORA_USD] | Proveedor de timbrado (PAC) en México |

## 3. Mantenimiento mensual

**[CUOTA_MENSUAL_USD] / mes**, que incluye: alojamiento en Vercel y Supabase en planes gratuitos o de entrada,
copias de seguridad, actualizaciones de seguridad, cambios menores del catálogo y precios (hasta 1 h/mes) y soporte por
WhatsApp en horario laboral. Los costes de terceros de la sección 2 se facturan aparte, al costo.

## 4. Moneda local

Mostrar siempre el total en USD y en la moneda del cliente con el tipo de cambio del día de la propuesta:

| | USD | Moneda local |
|---|---|---|
| Implantación | 20 × [TARIFA_HORA_USD] | × tipo de cambio (MXN, ARS, COP, PEN, CLP…) |
| Mantenimiento | [CUOTA_MENSUAL_USD] / mes | × tipo de cambio |

En Argentina conviene fijar el precio en USD y cobrar al tipo de cambio del día del pago.

## 5. Condiciones propuestas
- 50 % al aceptar, 50 % a la entrega. Validez de la propuesta: 15 días.
- 30 días de garantía sobre lo entregado.
- El código de la configuración del cliente es suyo; la base de la Fábrica sigue siendo de Jorge (licencia de uso).

## 6. Si el encargo llega por Kodarvia
El precio lo fija Kodarvia. Antes de postularse: comparar el pago con las 20 h de implantación (más integraciones) y
tener en cuenta su acuerdo: cesión total del código (la base de la Fábrica no debería ir incluida), 30 días de garantía,
pagos manuales desde 100 € y no captar al cliente final durante 12 meses. Si el pago por hora resultante queda por
debajo de [TARIFA_HORA_USD], no compensa.

## 7. PDF
Este mismo flujo es el que hace Presupuestín: cuando Jorge tenga sus tarifas, puede cargar estos conceptos como catálogo
(unidad "h") y generar con la propia app el PDF que envía al cliente.
