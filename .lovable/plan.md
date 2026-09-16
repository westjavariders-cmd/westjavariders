# Quitar el botón vacío que apareció en Build your trip

## Qué ha pasado

Al arreglar que las tarjetas de inicio "Explore West Java" y "Meet the Boardriders" fuesen pulsables, hice que cualquier bloque con destino devolviese un enlace aunque no tuviera texto de botón. Eso era correcto para las tarjetas de inicio, pero en el resto de bloques (como el de la página Build your trip) ese enlace se dibuja como un botón — y al no tener texto, aparece como un botón vacío bajo el contenido.

## Cambio

1. **`src/components/public/WebsiteRenderer.tsx`** — en los bloques normales (no tarjetas de inicio), el botón solo se muestra cuando tiene texto (`block.cta.label` no vacío). Los bloques con destino pero sin texto de botón ya no dibujan nada.
2. Las tarjetas de inicio (door) no se tocan: siguen siendo pulsables aunque no tengan texto de botón, como se pidió.

## Verificación

- Abrir la página Build your trip en el navegador de prueba y confirmar que el botón vacío ha desaparecido.
- Confirmar que las tarjetas de inicio siguen llevando a sus páginas.
- Typecheck, tests y build en verde.

## No se toca

Pago, vouchers, precios, productos, catálogos, configurador, navegación, Admin, contenido de las páginas.
