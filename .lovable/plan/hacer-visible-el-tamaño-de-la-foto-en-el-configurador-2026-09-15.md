# Hacer visible el tamaño de la foto en el configurador

El ajuste ya existe, pero está escondido: hay que abrir un paso, pulsar el nombre de la pregunta (el texto no parece pulsable) y bajar hasta el final del bloque de catálogo. Por eso no lo encuentras.

## Dónde está hoy

Producto > pestaña Configurator > paso > pulsar el nombre de la pregunta > se despliega la ficha > debajo del selector de catálogo aparece "Photo size".

## Qué se va a mejorar

1. **Cada pregunta se abre de forma evidente.** La fila de la pregunta pasa a ser una tarjeta pulsable completa, con una flecha que indica abrir/cerrar y un botón "Edit" visible.
2. **Aviso en la propia fila.** Cuando la pregunta toma sus opciones de un catálogo, la fila muestra el catálogo y el tamaño actual de la foto (Small / Medium / Large), así se ve sin abrir nada.
3. **El ajuste sube de posición.** Dentro de la ficha, "Photo size" pasa a estar justo al lado del selector de catálogo, con el título "Photo size shown to the customer" y tres botones (Small / Medium / Large) en lugar de una lista desplegable, para que se vea de un vistazo.
4. **Mensaje claro cuando no aplica.** Si las opciones de la pregunta se escriben a mano (sin catálogo), se indica en una línea que el tamaño solo afecta a las fotos que vienen del catálogo.

## Lo que no se toca

Precios, fórmulas, catálogos, vouchers, respuestas guardadas, pedidos y la web pública siguen exactamente igual. No hay cambios en la base de datos: la columna del tamaño ya existe y sigue con Large por defecto.

## Detalle técnico

- Solo `src/components/admin/configurator/ConfiguratorTab.tsx`: cabecera de fila de pregunta (chevron + botón Edit + resumen de catálogo/tamaño) y reordenación del control `photo_display_size` dentro de `FieldEditor`, cambiando el `select` por un grupo de botones controlado por el mismo estado `draft.photo_display_size`.
- Sin migración, sin cambios en `catalogue-bridge*`, `ConfiguratorForm.tsx` ni funciones de servidor.
- Verificación: typecheck, suite de tests y revisión visual del editor en Admin.
