# Voucher desde el carrito, compartir y contactar

Conectar lo que ya existe: al añadir al carrito ya nace el voucher con su número; el pago solo cambia su estado y dispara los emails; el botón de compartir deja de "guardar"; y aparece un formulario de contacto que llega al administrador con el voucher incluido.

## 1. El voucher nace al añadir al carrito

- Al terminar de configurar una experiencia y añadirla al carrito (también al reservar un artículo suelto de un catálogo), se crea automáticamente su voucher con el número correlativo `CBR-2026-001`, `CBR-2026-002`, … usando el contador que ya existe. El número se consume en ese momento y nunca se reutiliza.
- El voucher guarda la configuración y los precios de ese momento y queda con estado **UNPAID**.
- Aparece en Admin → Vouchers desde el primer momento, aunque el cliente nunca pague.
- No habrá ningún paso extra de "guardar voucher".
- Si el cliente quita esa experiencia del carrito, el voucher sigue en Admin como UNPAID con la información que ya tenía.

## 2. Al confirmarse el pago

- El mismo voucher pasa de UNPAID a **PAID**, conservando su número: no se crea un segundo voucher.
- Se completa con los datos definitivos de la compra (cliente, regalo, importes) y se envía el PDF por email al comprador con copia al administrador, exactamente como hoy.
- El envío sigue ocurriendo solo cuando el pago está confirmado por el proveedor, nunca al pulsar "Pay now".

## 3. Si no paga

- El voucher permanece en Admin como UNPAID y no se envía ningún email. No se añaden estados nuevos.

## 4. "Share your trip"

- El botón del carrito pasa a llamarse **SHARE YOUR TRIP** y solo comparte: enlace, copiar y compartir nativo del móvil.
- Reutiliza el enlace que ya corresponde a ese carrito: pulsarlo varias veces devuelve siempre el mismo enlace, sin crear registros nuevos ni tocar el voucher ni su número.

## 5 y 6. "Contact us" con el voucher incluido

- Debajo del botón de compartir: "Do you have any questions? Contact us", que abre un formulario sencillo con nombre, WhatsApp/teléfono, email y mensaje.
- Al enviarlo, la consulta se guarda y llega por email al administrador con los vouchers del carrito actual: número, experiencia, opciones elegidas, cantidades, días/noches/sesiones, desglose, total, mensaje y datos de contacto del cliente. Si hay varias experiencias, se listan todas.
- El cliente ve una confirmación clara; si el email no está configurado, la consulta queda igualmente guardada y visible.

## Detalles técnicos

- Migración: `voucher_status` gana `UNPAID` y `PAID` (se conserva `ACTIVE` para los vouchers históricos, que siguen siendo válidos); `vouchers.purchase_id` pasa a admitir nulos, `vouchers.package_id` admite nulos con `ON DELETE SET NULL`, y se añaden `cart_id` y `cart_snapshot jsonb` para el estado previo al pago. Nueva tabla `contact_requests` (nombre, teléfono, email, mensaje, `cart_id`, vouchers relacionados) con RLS: sin acceso anónimo directo, lectura solo Admin/Staff, escritura vía servidor. `saved_trips` gana `cart_id` único para reutilizar el enlace de compartir.
- Servidor: nuevo helper `ensureVoucherForCartLine` en `src/lib/voucher.server.ts`, llamado desde `completePackage` (`cart.server.ts`) y `addDirectBookingToCart` (`direct-booking.server.ts`); construye la entitlement con `buildEntitlement` sobre un snapshot de carrito con la forma que ya se usa, y con `orderedAnswerSummary` para el orden de respuestas. `issueVouchersForPurchase` pasa a adoptar el voucher existente del paquete (purchase_id, PAID, entitlement definitiva, validez) en lugar de ignorarlo, y sigue creando uno si no existiera. `deliverVouchersForPurchase` y `redemptionCheck` aceptan `PAID` igual que `ACTIVE`.
- Nuevo `src/lib/contact.server.ts` + `contact.functions.ts` (`submitContactRequest`, validación Zod, uso de `sendEmail` y `contact_email` de settings). `saveCurrentTrip` se vuelve idempotente por carrito. `src/routes/cart.tsx`: renombrado del botón y formulario de contacto.
- Sin cambios en pricing, configurador, cálculo de importes de pago, webhook ni PDF.
