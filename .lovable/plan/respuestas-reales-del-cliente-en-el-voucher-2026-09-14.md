# Respuestas reales del cliente en el voucher

## Qué pasa ahora

Revisé el último pedido real (CBR-1003) y su copia histórica. En el voucher salen líneas
de tipo sí/no porque:

1. Ese pedido se creó antes del cambio de ayer, así que su copia histórica no guarda las
   etiquetas de las preguntas. El voucher entonces usa un camino de reserva que recorre
   las respuestas en crudo: imprime todas las preguntas de sí/no (incluidas las que el
   cliente dejó en "No") y, cuando el cliente eligió algo de un catálogo, imprime un
   código interno en vez del nombre.
2. Las cantidades asociadas a una elección (personas, horas, días, noches) no son
   preguntas propias, así que hoy no se imprimen en ninguna línea.
3. Las preguntas que el cliente no usó ocupan sitio como "No", tapando lo que sí eligió.

## Qué voy a hacer

- Mostrar solo lo que el cliente eligió: se ocultan las preguntas contestadas con "No" o
  dejadas vacías, tanto en el voucher como en el resumen del carrito y del pedido.
- Cada elección de catálogo se muestra con su nombre real (por ejemplo "Price per people"),
  nunca con un código interno. Si no hay nombre disponible, la línea no se imprime.
- Debajo de cada elección se añaden sus cantidades: personas, horas, días o noches, con
  su etiqueta en texto claro.
- Los vouchers de pedidos antiguos también salen bien: el camino de reserva se reescribe
  para usar los datos que sí guarda la copia histórica (elecciones de catálogo y valores
  resueltos), con las mismas reglas de arriba.
- Se mantiene el orden del configurador ya implementado y el desglose de precios (nombre,
  precio base, importes parciales, total; en vouchers regalo sin importes).

## Detalles técnicos

- `src/lib/public-catalog.ts` → `summarizeAnswers`:
  - omite valores booleanos `false` y cadenas vacías;
  - para `single_select`/`multi_select` sin `field_options`, resuelve el valor con
    `catalogueNames`; si no hay nombre y el valor tiene forma de UUID, se descarta la línea;
  - tras cada línea, añade las sub-respuestas `<variable>_people`, `_hours`, `_days`,
    `_nights` presentes en `answers`, con etiquetas "People", "Hours", "Days", "Nights"
    (las claves con sufijo dejan de imprimirse como preguntas suéltas).
- `src/lib/voucher.ts` → `optionLabels`: cuando el snapshot no trae `option_labels`,
  construye las líneas desde `answers` + `catalogue_selections` + `resolved_inputs`
  aplicando las mismas reglas (nombres en vez de ids, sin "No", con cantidades).
- Sin cambios de esquema; sin tocar precios, fórmulas, configurador, catálogos ni pagos.
- Verificación: tests nuevos en `public-catalog.test.ts` (booleanos "No" fuera, nombre de
  catálogo, cantidades) y en `voucher.test.ts` (snapshot antiguo sin `option_labels`);
  `bunx tsgo --noEmit`, `bunx vitest run` y revisión del registro de compilación.
