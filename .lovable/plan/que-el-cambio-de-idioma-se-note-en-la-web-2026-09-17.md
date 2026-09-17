# Que el cambio de idioma se note en la web

## Qué pasa ahora

El selector de idioma funciona y recuerda la elección, pero en la web solo existen los textos en inglés: no hay ni una traducción guardada en los otros idiomas. Cuando falta una traducción, la web muestra el inglés. Por eso al cambiar de idioma se ve exactamente lo mismo.

## Qué haremos (lo más habitual en una web)

Traducción automática desde Admin, revisable por ti:

- En Admin → Website → Pages, con un idioma activo distinto del inglés, aparece un botón **Translate this page**.
- Al pulsarlo se traducen los textos de esa página (título, secciones y bloques: títulos, descripciones y textos de botón) al idioma elegido, y se guardan como cualquier traducción escrita a mano.
- Puedes editarlos después; volver a pulsar el botón sobrescribe solo los campos vacíos, salvo que marques "sobrescribir lo existente".
- El nombre **West Java Riders** nunca se traduce.
- Mientras una página no esté traducida, el visitante sigue viendo el inglés (comportamiento actual, sin roturas).

Los textos fijos de la interfaz (Add to cart, avisos del carrito, formularios) se quedan en inglés, como pediste.

## Detalles técnicos

- Nueva función de servidor `translateWebsitePage` en `src/lib/website.functions.ts` (solo ADMIN/STAFF): lee las traducciones master (`en`) de la página, secciones y bloques, traduce vía Lovable AI Gateway en una sola llamada con salida estructurada, y guarda con el `upsertTranslation` ya existente (`website_page_translations`, `website_section_translations`, `website_block_translations`) usando `language_code` = idioma activo.
- Sin migración de base de datos: se reutilizan las tablas de traducción actuales.
- Sin cambios en el selector, en `language.server.ts`, en `website.server.ts`, ni en el renderizado público: la cadena idioma pedido → master ya está correcta.
- Sin tocar precios, productos, configurador, carrito, vouchers ni pagos.

## Verificación

- Traducir la página de inicio a español desde Admin y comprobar en la web pública que, al elegir ES, se ven los textos en español y al elegir EN vuelven al inglés.
- Comprobar que una página sin traducir sigue mostrándose en inglés.
