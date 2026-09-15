# Fotografías de las opciones en el configurador

## Qué ocurre hoy

En el configurador público, las opciones que vienen de un catálogo se muestran solo como botones con nombre y precio. La fotografía existe en el catálogo (las habitaciones pueden tener varias; las motos, una) pero nunca se muestra en el configurador. Además, hoy solo se transporta una foto por artículo, no todas.

## Qué se hará

1. **Mostrar la foto de la opción elegida.** Debajo de los botones de la pregunta aparece la fotografía del artículo seleccionado.
2. **Ver el resto de fotos.** Si el artículo tiene más de una, se puede pasar de una a otra (flechas y puntos indicadores) y se indica "1 / 3". Con una sola foto no aparece ningún control.
3. **Preguntas de varias opciones.** Cuando se pueden marcar dos o más, la galería muestra la última opción marcada, ya que las fotos de la anterior se dan por vistas. Al desmarcarla, se vuelve a la que siga marcada.
4. **Sin foto, sin hueco.** Los artículos sin fotografía (por ejemplo transportes) no dejan espacio vacío ni marco.
5. Se traen todas las fotos del artículo, no solo la principal, con la principal siempre primera.

No se toca el precio, ni el orden de preguntas, ni los catálogos en Admin, ni el voucher, ni las opciones manuales (que no tienen fotografía).

## Detalles técnicos

- `src/lib/catalogue-bridge.ts`: añadir `photo_urls: string[]` a `CatalogueItem` y poblarlo en `toCatalogueItem` (fallback a `[photo_url]` cuando exista). Se conserva `photo_url` como primera foto para no romper `/book/$catalogueId/$itemId` ni ningún consumidor actual.
- `src/lib/catalogue-bridge.server.ts`: en `accommodationRooms`, firmar todas las fotos de la habitación ordenadas por `is_primary` y luego `sort_order`; en `motorbikes`, la única foto; en `transports`, lista vacía.
- `src/components/public/ConfiguratorForm.tsx`: nuevo componente local de galería (imagen + flechas + puntos + contador) y estado por pregunta con el índice de foto visible y el artículo mostrado. Para `multi_select`, el artículo mostrado es el último añadido a la lista de respuestas; al quitarlo se cae al último que quede. `loading="lazy"` y `alt` con el nombre del artículo.
- Sin cambios de base de datos ni de esquema.
