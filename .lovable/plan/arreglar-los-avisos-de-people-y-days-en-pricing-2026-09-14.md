# Arreglar los avisos de "people" y "days" en Pricing

## Qué está pasando (verificado en tus datos)

No es cosa tuya: las dos variables realmente **no existen** en ningún producto. Lo he comprobado consultando la base de datos:

- En Pricing del producto plantilla, las casillas de cantidad "People" y "Days" están guardadas apuntando a `choosenumberpeople` y `choosenumberofdays`.
- Ninguna pregunta del configurador se llama así, ni en la plantilla ni en la copia. En una versión antigua de la fórmula sí existía una pregunta `choosenumberpeopleandclassquesion`, que después renombraste a `choosepeoplelessons`.
- Al renombrar (o borrar) una pregunta, el sistema **no actualiza ni limpia** esos apuntes de Pricing. Quedaron colgando.
- La plantilla se activó *antes* de ese renombrado, así que sigue activa arrastrando el apunte roto; la copia nueva hereda el apunte y ahí sí bloquea la activación.
- Además, en la pantalla de Pricing esas dos casillas se ven como "Not used" (el valor guardado no coincide con ninguna pregunta de la lista), así que el apunte roto es invisible y no lo puedes quitar.
- Tus fórmulas activas no usan esas dos variables, así que quitar los apuntes no cambia ningún precio.

## Qué haré

1. **Limpiar los datos actuales**: quitar los apuntes de cantidad que no correspondan a ninguna pregunta existente, en todos los productos. Sin tocar fórmulas, reglas ni importes.
2. **Hacer visible el problema**: si un apunte de cantidad queda apuntando a una pregunta que ya no existe, la casilla lo mostrará como "Falta: nombre" en rojo, con opción de dejarlo en "No usado" con un clic.
3. **Arreglar el renombrado**: al cambiar el nombre interno de una pregunta numérica, los apuntes de cantidad de Pricing y las referencias de las reglas se actualizan solos al nombre nuevo.
4. **Arreglar el borrado/desactivado**: al borrar una pregunta usada como cantidad, ese apunte se limpia en el mismo momento y se avisa.
5. **Arreglar la duplicación de productos**: la copia solo hereda los apuntes de cantidad cuyas preguntas existan de verdad en la copia; los que no, entran vacíos en vez de heredar un error.
6. **Mensaje de error más claro**: en vez de "no es una pregunta numérica activa", dirá que el apunte señala una pregunta que ya no existe y que se puede vaciar.

## Detalles técnicos

- Migración de limpieza: `UPDATE product_pricing` poniendo a `NULL` cada uno de `people_variable`, `days_variable`, `nights_variable`, `sessions_variable` cuando no exista una fila en `fields` del mismo `product_id` con ese `variable_name` y `field_type IN ('quantity','number')`.
- Cascada de renombrado y limpieza al borrar: en el guardado de campo de `src/components/admin/configurator/ConfiguratorTab.tsx` (que ya conoce `renamed_from`), extendido con una función servidor en `src/lib/catalog.functions.ts` que actualiza `product_pricing` (4 columnas) y `pricing_rules` (`variable_name`, `quantity_variable`, `condition_variable`) del mismo producto de forma atómica.
- `duplicate_product` (función SQL): al insertar `product_pricing`, cada `*_variable` se copia solo si existe un campo copiado con ese `variable_name` y tipo numérico; si no, `NULL`.
- UI: en `PricingTab.tsx`, el `select` de mapeo añade una opción "Falta: X" cuando el valor guardado no está entre las preguntas numéricas activas, marcada en rojo.
- Mensaje en `validatePricing` (`src/lib/pricing.ts:697-701`) diferenciado: pregunta inexistente vs. existente pero no numérica/inactiva.
- Verificación: `bunx tsgo --noEmit`, `bunx vitest run`, más una prueba nueva del caso "apunte huérfano" y comprobación de que la copia del producto ya activa Pricing.
