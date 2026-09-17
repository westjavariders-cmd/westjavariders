# Traducir toda la web, con opción de corregir a mano

Hoy solo se traducen los textos de las páginas del sitio, y una a una (la que tienes abierta). El resto de la web —menú, pantalla de entrada, nombres y descripciones de las experiencias, preguntas del configurador, catálogos y los textos fijos como "Add to cart"— siempre se muestra en inglés.

El objetivo: que el visitante vea toda la web en el idioma que elija, con inglés como reserva cuando falte algo, y que tú puedas corregir cualquier traducción a mano desde el panel. "West Java Riders" nunca se traduce.

## Cómo funcionará

- Un botón **Translate site** en el panel (Website) traduce de una vez todo lo que falte en el idioma seleccionado.
- Además, cada zona conserva su botón para traducir solo esa parte (páginas, experiencias, catálogos).
- Todo lo traducido queda guardado en campos editables: puedes reescribir cualquier frase a mano y la traducción automática **no la sobrescribe**. Solo el botón aparte **Retranslate everything** rehace lo ya traducido.
- Si un texto no tiene traducción, el visitante ve el inglés (como ahora, sin roturas).

## Fases

Se hace por fases para poder probar cada parte sin romper nada. Cada fase queda funcionando por sí sola.

**Fase 1 — Sitio completo (páginas, menú, pantalla de entrada)**
- Botón "Translate site": recorre todas las páginas (no solo la abierta), las secciones y los bloques.
- Añade los enlaces del menú superior y los textos de la pantalla de bienvenida, que ya tienen sitio donde guardarse por idioma y ya son editables en el panel.

**Fase 2 — Experiencias y preguntas del configurador**
- Títulos, resúmenes y descripciones de cada experiencia en el idioma elegido (ya existe dónde guardarlos; hoy la web los pide siempre en inglés).
- Preguntas del configurador, sus textos de ayuda, los títulos de cada paso y las opciones: hoy solo existen en un idioma, así que hace falta preparar la base de datos para guardarlos por idioma, y añadirlos al editor del configurador para poder corregirlos.
- Botón de traducir dentro de cada experiencia, y también incluido en "Translate site".

**Fase 3 — Catálogos**
- Nombres y descripciones de alojamientos/habitaciones, transportes y motos que ve el cliente, más las etiquetas de "número de personas" y "duración en horas".
- Igual que arriba: guardado por idioma, traducción automática y edición a mano.

**Fase 4 — Textos fijos de la interfaz**
- Botones y avisos que no se escriben en el panel: "Add to cart", el carrito, el resumen de pago, el formulario de contacto, "Share your trip", mensajes de error.
- Se reúnen en una lista única de frases traducibles, se traducen con IA y se pueden corregir desde el panel (Settings → Languages).

## Fuera de alcance

- Vouchers, PDF y emails: se mantienen como están (salvo que lo pidas después).
- Panel de Admin: sigue en inglés.
- Precios, pagos, carrito, checkout, vouchers y navegación: sin cambios de lógica.

## Detalles técnicos

- Reutiliza `src/lib/translate.server.ts` (Lovable AI, `openai/gpt-6-astra`, salida JSON por claves) y el patrón de `translateWebsitePage` en `src/lib/website.functions.ts`; lista protegida `DO_NOT_TRANSLATE` con "West Java Riders" / "Cimaja Boardriders".
- Fase 1: nueva función de servidor que itera `website_pages` y reutiliza la lógica actual por página, más `website_nav_item_translations` y `website_landing_translations`. Sin migración.
- Fase 2: migración con `step_translations`, `field_translations` y `field_option_translations` (`*_id`, `language_code`, columnas de texto, unique por `(*_id, language_code)`, GRANT + RLS igual que las tablas de traducción existentes). El sitio público (`public-catalog.server.ts`, `catalog-fetch.ts`) pasa a pedir el idioma resuelto con reserva a `MASTER_LANGUAGE` en lugar de fijarlo.
- Fase 3: misma pauta para los textos de catálogo visibles al cliente y `people_label` / `hours_label`.
- Fase 4: diccionario de frases de interfaz por idioma (tabla `ui_strings` + traducciones) leído en servidor y pasado a los componentes públicos; los textos actuales quedan como valor en inglés por defecto.
- Las selecciones ya congeladas en carritos, pedidos y vouchers no se tocan: los snapshots históricos siguen mostrando lo que se guardó.
