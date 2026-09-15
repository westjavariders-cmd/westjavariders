# Guardar y compartir el viaje (Save & share your trip)

## Qué verá el usuario

1. En el carrito, debajo del total y sin estorbar al botón de pago, un botón discreto **SAVE & SHARE YOUR TRIP** con el texto de apoyo "Save your trip and share it with your travel companions."
2. Al pulsarlo se genera un enlace propio del tipo `/trip/CBR-X7K4P` y aparece un bloque sencillo: "YOUR TRIP IS SAVED", el enlace, **COPY LINK** y, si el navegador lo permite, **SHARE** (compartir nativo del móvil).
3. Cualquiera que abra ese enlace ve el viaje reconstruido con los precios de hoy: cada parte del viaje con su nombre, sus opciones elegidas y su importe, más el total.
4. En esa página hay dos acciones: **EDIT TRIP** y **CONTINUE TO CHECKOUT**. Ambas cargan el viaje en el carrito de quien abre el enlace y le llevan al carrito, que es donde ya se paga hoy.
5. Si algo del viaje ya no está disponible o ha cambiado de precio, se avisa con un texto claro en esa parte y el resto del viaje sigue funcionando.
6. Si el enlace no existe o ha caducado: "THIS TRIP IS NO LONGER AVAILABLE" y un botón **BUILD YOUR TRIP**.

No se pide cuenta, registro, email ni ningún dato personal para guardar o abrir un viaje. No se guarda nombre, teléfono, email ni datos de pago.

## Alcance y límites

- No se toca el pago, los vouchers, los precios, los productos, los catálogos, el configurador, la navegación ni las páginas `/` y `/home`.
- No hay panel "My Trips", ni cuentas, ni edición administrativa de viajes guardados.
- Los productos siguen siendo la única fuente de verdad: el viaje guardado solo almacena referencias e identificadores.

## Detalle técnico

- **Migración** (una tabla nueva, mínima): `public.saved_trips` con `id uuid pk`, `code text unique` (formato `CBR-` + 5 caracteres de un alfabeto sin ambigüedades, generado en servidor con `crypto.getRandomValues`), `lines jsonb not null`, `created_at timestamptz default now()`, `expires_at timestamptz default now() + interval '180 days'`. RLS activada; sin políticas para `anon`/`authenticated`; `GRANT ALL ... TO service_role` (solo se lee/escribe desde funciones de servidor con el cliente admin). Ninguna tabla existente se modifica.
- **Qué se guarda por línea** (solo configuración, nunca importes): para paquetes `{ kind: 'package', product_id, answers, season_month, promo_code }`; para reservas directas `{ kind: 'catalogue_item', catalogue_id, catalogue_item_id, answers }`. Se copia de las filas `packages` completas del carrito actual, sin duplicar información comercial.
- **Nuevo módulo** `src/lib/saved-trip.server.ts`: `saveCurrentTrip()` (lee con `listCart`, guarda las líneas completas, devuelve el código), `readSavedTrip(code)` (comprueba caducidad, recalcula cada línea en vivo: paquetes con `quotePackage` y directos con `quoteDirectBooking`, devolviendo por línea título, resumen, total actual y avisos), y `loadSavedTripIntoCart(code)` (crea de nuevo las líneas en el carrito de sesión reutilizando `startPackage` + `savePackage` + `completePackage` para paquetes y `addDirectBookingToCart` para directos, omitiendo lo ya no disponible y devolviendo qué se omitió). Cero lógica de precios nueva: todo pasa por el motor actual.
- **Nuevo** `src/lib/saved-trip.functions.ts` con tres server functions (`saveTrip`, `getSavedTrip`, `loadSavedTrip`), validadas con Zod, anónimas como el resto del carrito.
- **Nueva ruta** `src/routes/trip.$code.tsx` con `head()` propio (título y descripción específicos, `noindex` porque es un enlace privado), envuelta en `PublicPage` para heredar el tema negro sobre blanco actual.
- **`src/routes/cart.tsx`**: se añade el bloque de guardar/compartir (botón, enlace, copiar, compartir nativo con `navigator.share` cuando exista). No se cambia ningún campo, validación ni acción del pago actual.
- **Textos**: en inglés, igual que el resto de la web pública, sin crear ningún sistema de traducción paralelo.
- **Verificación**: typecheck, la suite de tests (más tests nuevos para el guardado y la reconstrucción), y prueba de extremo a extremo con navegador: configurar → guardar → copiar enlace → abrir en sesión limpia → comprobar reconstrucción y precio recalculado → editar → llegar al pago; además comprobar `/`, `/home` y el carrito sin cambios.
