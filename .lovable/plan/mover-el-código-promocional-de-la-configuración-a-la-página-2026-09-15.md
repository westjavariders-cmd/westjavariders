# Mover el código promocional de la configuración a la página de inicio

## Qué cambia para el cliente

1. **En la configuración de una experiencia** desaparece el campo "Promo code (optional)". Solo queda el precio, los descuentos y los avisos.
2. **En la página de inicio**, junto al enlace discreto de acceso de personal, aparece un enlace pequeño: "Have a promo code?". Al pulsarlo se abre un campo minúsculo con un botón "Apply".
3. Al aplicar un código, el inicio muestra en pequeño "Promo code XXXX applied", con la opción de quitarlo.
4. El código queda guardado en el navegador del cliente y se aplica solo al calcular el precio de cualquier experiencia que configure y en el carrito, igual que ahora.
5. Si el código no existe o no es válido para esa experiencia, el aviso sigue apareciendo donde está el precio, dentro de la configuración.

## Detalle técnico

- `src/components/public/HomeContent.tsx`: nuevo componente discreto `PromoCodeEntry` (estado local abierto/cerrado, input en mayúsculas, máximo 40 caracteres, `trim`), guardado en `localStorage` con la clave `cbr_promo_code`. Lectura dentro de `useEffect` para no romper la hidratación SSR.
- Nuevo módulo cliente pequeño `src/lib/promo-code-storage.ts` con `readStoredPromoCode()`, `writeStoredPromoCode()`, `clearStoredPromoCode()`, protegidos frente a la ausencia de `window`.
- `src/components/public/ConfiguratorForm.tsx`: se elimina el bloque del input de promo; el estado `promo` pasa a inicializarse desde `savedPromo` y a completarse en un `useEffect` con el código guardado en el navegador cuando no hay ninguno en el borrador. Se sigue enviando `promoCode` en cada cotización, sin cambios en `savePackageConfiguration`.
- El mensaje `quote.promo_rejection` se mantiene visible en la tarjeta de precio.
- Sin migración y sin cambios en `cart.server.ts`, `cart.functions.ts`, motor de precios, vouchers ni Admin → Promo codes.

## Verificación

- Typecheck y suite de tests.
- Revisión con navegador: aplicar un código en el inicio, entrar en una experiencia y comprobar que el descuento o el aviso aparece sin campo de promo; quitar el código y confirmar que el precio vuelve al normal.
