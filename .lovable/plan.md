# Imagen de portada del producto: ¿es necesaria?

## Conclusión de la revisión

La página de portada de cada experiencia (PackageLanding) ya muestra como imagen hero grande la misma foto que se sube en Admin → Products → Content ("Package image"). Una sola foto por producto alimenta hoy:

- La tarjeta pequeña de Build your trip.
- El hero grande de la portada de la experiencia.

Es decir: la "landing image" tal como se planteó no aporta nada nuevo. Solo tendría sentido si se quiere una foto distinta para el hero de la portada y otra para la tarjeta.

## Opciones

### Opción A — No cambiar nada (recomendada)

Una foto por producto basta. No se toca base de datos, Admin ni web.

### Opción B — Foto distinta para la portada (solo si la quieres)

1. Migración: `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS landing_image_path text;` y regenerar tipos.
2. `src/lib/catalog.ts`: helper `productLandingImagePath` (mismo patrón que `productImagePath`).
3. `src/lib/catalog.functions.ts`: `setProductLandingImage` (solo ADMIN, limpieza de storage si la ruta queda sin usos, auditoría `product_landing_image_set`/`product_landing_image_removed`).
4. `src/routes/admin/_app/products.$productId.tsx`: segundo editor en la pestaña Content, etiqueta "Landing image", reutilizando el editor de imagen actual.
5. `src/lib/public-catalog.server.ts`: incluir `landing_image_path` y servir `landing_image_url` con URL firmada.
6. `src/components/public/PackageLanding.tsx`: el hero usa `landingImageUrl` si existe; si no, la foto normal (fallback).
7. Verificación: typecheck, tests, build y prueba en navegador (subir foto de portada, verla en la web).

## Qué no se toca en ningún caso

- La tarjeta de Build your trip (sigue con la Package image).
- Pricing, configurador, carrito, vouchers, pago, navegación ni el resto de imágenes del proyecto.

## Verificación

Si se aprueba la opción B: typecheck limpio, suite de tests, build OK y prueba E2E en navegador subiendo una foto de portada en Admin y comprobando que la portada la muestra y que, al quitarla, vuelve a usar la foto normal.
