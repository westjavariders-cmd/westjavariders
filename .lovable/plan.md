# Corregir definitivamente el orden de las respuestas del voucher

## Problema confirmado

- El pedido existente (`CBR-1003`) se creó antes de guardar `option_labels`, por lo que su snapshot no contiene la lista ordenada.
- En ese caso antiguo, el voucher reconstruye las respuestas recorriendo el objeto de respuestas. Ese objeto no conserva el orden visual del cuestionario.
- El detalle del pedido en Admin también muestra directamente ese objeto, por lo que tampoco respeta el configurador.
- Los pedidos nuevos ya calculan las respuestas por paso y pregunta, pero falta usar una única representación ordenada en todas las salidas y cubrir correctamente los pedidos antiguos.

## Cambio

1. Crear un único resumen de respuestas ordenado por:
   - orden del step en Configurator;
   - orden de la pregunta dentro del step;
   - cantidades asociadas inmediatamente después de su elección.
2. Excluir siempre las preguntas de Sí/No, tanto si la respuesta es Sí como si es No.
3. Usar ese mismo resumen en:
   - voucher del cliente;
   - PDF y email;
   - detalle del voucher en Admin;
   - resumen del pedido en Admin.
4. Para pedidos nuevos, guardar el resumen ordenado dentro del snapshot, como dato histórico inmutable.
5. Para el pedido antiguo que no tiene ese resumen, reconstruirlo al regenerar el voucher usando el orden actual del configurador y las selecciones de catálogo guardadas, sin modificar precios, respuestas ni el snapshot original.

## Límites

- No se añaden casillas ni campos al Configurator.
- No se cambia Pricing, fórmulas, importes ni respuestas.
- No se borran pedidos ni vouchers.
- Si una pregunta antigua fue eliminada o renombrada y ya no puede relacionarse con el configurador actual, se colocará al final en lugar de perderla.

## Verificación

- Probar orden entre varios steps y varias preguntas del mismo step.
- Probar que Sí y No no aparecen.
- Probar que personas, horas, días y noches quedan junto a su elección.
- Probar un pedido nuevo y el pedido antiguo sin `option_labels`.
- Confirmar el mismo orden en Admin, PDF y email.
- Ejecutar todas las pruebas y comprobar que la aplicación compila correctamente.
