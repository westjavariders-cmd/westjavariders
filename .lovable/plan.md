# Que los accesos de la portada usen el título de cada página

## Qué está pasando

Los cuatro accesos que se ven en la portada (Build your trip, Book individually, Explore West Java, Meet the Boardriders) **no** leen el "Displayed title" ni el "Supporting text" de cada página. Son bloques propios dentro de la portada, con su propio título y texto, guardados en Admin → Website → Pages → Home → sección "Main doors".

Comprobado: en la página "Build your trip" el título guardado es "Build your trip in 2 minutes", y el acceso de la portada tiene su propio título "Build your trip". Por eso al cambiar el título de la página el acceso no cambia.

## Qué se va a hacer

1. **El acceso hereda el texto de la página a la que lleva.** Si un acceso apunta a una página del sitio y no tiene título propio escrito, mostrará el "Displayed title" de esa página; y si no tiene texto propio, mostrará su "Supporting text". Así, cambiando el título de la página se actualiza también la portada.
2. **Se respeta lo escrito a mano.** Si el acceso tiene su propio título o texto escrito, ese sigue teniendo prioridad (nada de lo ya configurado cambia por sorpresa).
3. **Aviso claro en Admin.** En el editor de cada acceso, junto a los campos de título y texto, se indicará: "Si lo dejas vacío se usará el título y el texto de la página de destino".
4. Para que los cuatro accesos de la portada empiecen a seguir el título de sus páginas, bastará con vaciar su título/texto propio en Admin; también se puede dejar como está.

## Detalle técnico

- Solo lectura pública: en `src/lib/website.server.ts`, dentro de `websitePage`, cuando un bloque tiene `cta_kind = 'page'` (o el destino resuelto es una página del sitio) se cargan las traducciones de `website_page_translations` de esa página en el idioma pedido, con el mismo `pickTranslation` e idioma de reserva ya usado. `title` del bloque pasa a ser `blockText?.title ?? pageTitleDeDestino ?? null` y `body` a `blockText?.body ?? pageSubtitleDeDestino ?? null`.
- Se aprovecha la consulta `ctaPages` ya existente (que hoy solo trae `id, slug, is_active`) para conocer las páginas destino activas; se añade una única consulta de traducciones para esos ids.
- Nada de esto afecta a precios, productos, catálogos, vouchers ni al carrito. Sin migración de base de datos.
- Admin: solo un texto de ayuda en el editor de bloques (`src/routes/admin/_app/website.$pageId.tsx`); no cambia cómo se guarda.
- Verificación: typecheck, suite de tests y revisión de `/home` comprobando que el acceso muestra "Build your trip in 2 minutes" cuando el bloque no tiene título propio.
