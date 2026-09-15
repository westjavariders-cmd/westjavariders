# Que lleguen los emails del formulario de contacto

## Qué ha pasado

Tu consulta sí se guardó (la del 15 de septiembre a las 16:34, desde remesal3c@gmail.com), pero quedó marcada como "no enviada" con el motivo: no hay remitente de email configurado en el proyecto.

El email del negocio (westjavariders@gmail.com) y el WhatsApp ya están rellenados, así que no falta nada por tu parte ahí. Lo que falta es el dominio desde el que se envían los emails: sin él, ni las consultas de contacto ni los vouchers en PDF pueden salir.

## Qué hay que hacer

1. Configurar el dominio de envío (un dominio tuyo, por ejemplo westjavariders.com). Es un paso guiado; sólo hay que elegir el dominio y esperar la verificación, que puede tardar hasta 72 horas.
2. Una vez verificado, reenviar la consulta pendiente que quedó guardada, para no perderla.
3. Comprobar de punta a punta: enviar una consulta de prueba desde el carrito y confirmar que llega a westjavariders@gmail.com con el voucher incluido.

Si no tienes todavía un dominio propio, se puede comprar desde los ajustes del proyecto o en cualquier registrador; sin dominio propio no es posible enviar emails de la aplicación.

## Detalles técnicos

- `src/lib/email.server.ts` devuelve `not_configured` cuando faltan `LOVABLE_API_KEY` o el dominio remitente; eso es exactamente lo que registró `contact_requests.email_error`. No hay ningún error de código en el formulario ni en `submitContactRequest`.
- Tras verificar el dominio, adaptar `email.server.ts` al envío gestionado (dominio delegado como remitente en el campo `from`), sin tocar el formulario, `contact.server.ts`, precios, vouchers ni pagos.
- Reenvío de la consulta pendiente: una única llamada a `sendEmail` reutilizando la fila guardada y su `idempotencyKey`, actualizando `email_status` a `SENT`.
