# Enlazar "Epic Trips" desde el inicio y el menú

## Qué ocurre ahora

Lo que creaste hoy no es un quinto apartado dentro de la página de inicio: es una **página nueva llamada "Epic Trips"**, con dos apartados dentro (Begginers y readyintermediates). Está activa y guardada correctamente.

La página de inicio sigue teniendo solo cuatro tarjetas (Build your trip, Select Activities individually, Explore West Java, Meet the Boardriders) y ninguna lleva a Epic Trips. El menú superior también tiene solo esas cuatro entradas. Por eso no la ves desde el inicio.

## Qué haré

1. Añadir una **quinta tarjeta en la página de inicio** con el título "Epic Trips", que lleva a esa página.
2. Añadir una **entrada "Epic Trips" en el menú superior**, después de Meet the Boardriders.

Ambas quedarán visibles en la web pública y editables desde Admin → Website como el resto (título, texto y traducciones).

## Detalles técnicos

- Sin cambios de código y sin migración: solo datos.
- Nuevo `website_blocks` en la sección "Main doors" de la página `home`: `block_kind = 'door'`, `cta_kind = 'page'`, `cta_page_id` = id de la página `epictrips`, `sort_order = 4`, `is_active = true`, más su fila en `website_block_translations` (idioma `en`, título "Epic Trips").
- Nuevo `website_nav_items`: `destination_kind = 'page'`, `destination_page_id` = misma página, `sort_order = 4`, `is_active = true`, más su `website_nav_item_translations` en `en`.
- No se toca ninguna otra tarjeta, sección, página, producto ni precio.

## Nota

De momento el título irá en inglés ("Epic Trips"). Las traducciones a los demás idiomas las puedes escribir tú desde Admin → Website cuando quieras; si falta una, se muestra el inglés.
