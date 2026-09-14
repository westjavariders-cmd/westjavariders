# Orden de las opciones en el voucher

## Objetivo

Que las opciones elegidas por el cliente salgan en el voucher en el mismo orden en que aparecen en el configurador: primer paso primero, y dentro de cada paso las preguntas en su orden. Sin campos nuevos que rellenar.

## Qué cambia para ti

- En el voucher (PDF y email) y en el resumen del pedido, las opciones dejan de salir desordenadas y siguen exactamente el orden del configurador del producto.
- Si reordenas pasos o preguntas en el configurador, los vouchers nuevos respetan ese orden automáticamente.
- Nada se borra: precios, fórmulas, nombres y vouchers ya emitidos quedan igual.

## Detalles técnicos

- `src/lib/purchase.server.ts` (`revalidateCart`): la consulta de `fields` ordena solo por `display_order`, lo que mezcla preguntas de distintos pasos. Se añade la lectura de `steps` (`id, display_order, is_active`) del producto y las preguntas se ordenan por `display_order` del paso y luego por `display_order` de la pregunta antes de pasarlas a `summarizeAnswers`. Preguntas sin `step_id` van al final, conservando su orden actual.
- `summarizeAnswers` en `src/lib/public-catalog.ts` ya respeta el orden del array recibido: no se toca.
- `option_labels` del snapshot queda ordenado en origen, así que voucher, PDF y email heredan el orden sin cambios en `voucher.ts`, `voucher-pdf.server.ts` ni `voucher-delivery.ts`.

## Verificación

- Test nuevo en `src/lib/public-catalog.test.ts` o `purchase.test.ts` que comprueba el orden por paso.
- `bunx tsgo --noEmit`, `bunx vitest run` y revisión del log de build.
