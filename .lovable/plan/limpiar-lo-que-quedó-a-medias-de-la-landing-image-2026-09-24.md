# Limpiar lo que quedó a medias de la "landing image"

## Qué encontré
- Tenías razón: la portada de cada experiencia ya usa la foto de Admin → Products → Content. No hacía falta nada nuevo.
- Quedaron dos restos de la implementación que se paró:
  1. En `src/lib/catalog.ts` hay **dos copias** de la misma función `productLandingImagePath` (líneas 100–110). Esto **rompe la compilación** ahora mismo. Nadie usa esa función.
  2. En la base de datos se añadió la columna `products.landing_image_path` (vacía, nadie la usa). No hace daño.
- Nada más cambió: ni Admin, ni la web, ni las funciones de servidor.

## Qué haré
1. Borrar las dos copias de `productLandingImagePath` de `src/lib/catalog.ts`, dejando el fichero como estaba antes.
2. Dejar la columna vacía en la base de datos (quitarla no aporta nada y podría usarse más adelante). Si prefieres quitarla también, lo hago con una migración `DROP COLUMN`.
3. Comprobar que la compilación vuelve a estar en verde.
