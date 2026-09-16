# Las tarjetas de inicio "Explore West Java" y "Meet the Boardriders" no enlazan

## Causa (confirmada)

En la web pública, una tarjeta de la página de inicio solo se convierte en enlace cuando tiene **las dos cosas**: destino configurado y un texto de botón ("Button label"). Las tarjetas "Explore West Java" y "Meet the Boardriders" tienen el destino bien configurado (apuntan a sus páginas), pero el campo de texto del botón está vacío, así que la tarjeta se dibuja sin enlace y no lleva a ninguna parte.

No hace falta tocar Navigation: el menú superior ya funciona porque se construye por otra vía.

## Cambios

1. **El enlace ya no depende del texto del botón** — en `src/lib/website.server.ts`, la tarjeta obtiene su enlace en cuanto hay un destino configurado, aunque el texto del botón esté vacío.
2. **La tarjeta entera se vuelve pulsable** — en `src/components/public/WebsiteRenderer.tsx`, las tarjetas de acceso ("doors") enlazan a su destino aunque no haya texto de botón; si hay texto, se sigue mostrando como hasta ahora; si no, simplemente la tarjeta entera es el enlace.
3. Nada más cambia: menús, páginas, contenidos y diseño quedan igual. Quien quiera seguir poniendo texto de botón puede hacerlo y se verá igual que ahora.

## Detalles técnicos

- `website.server.ts`: en la construcción del bloque, `cta` pasa a ser `destination ? { label: blockText?.cta_label ?? "", ...destination } : null` (antes exigía `cta_label` no vacío).
- `WebsiteRenderer.tsx`: en el bloque `door`, el texto auxiliar solo se muestra cuando la etiqueta no está vacía; el envoltorio `<a>` se mantiene para cualquier `cta` con destino (interno o externo).
- Sin migración de base de datos, sin cambios en Admin, sin cambios en rutas.

## Verificación

- Typecheck, tests y build.
- Con el navegador de prueba: pulsar "Explore West Java" y "Meet the Boardriders" en la página de inicio y confirmar que navegan a su página; confirmar que "Build your trip" y las demás tarjetas siguen igual.
