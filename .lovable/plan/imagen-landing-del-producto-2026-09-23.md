# Imagen "landing" del producto

Cada producto tendrá una **segunda imagen opcional**, más grande, que se
muestra solo en la **portada pública del producto** (`/build-your-trip/$productId`).
La imagen "Package image" existente se sigue usando para la tarjeta pequeña
de *Build your trip*. Si un producto no tiene imagen landing, la portada
muestra la Package image (como hasta ahora), para que nunca quede vacía.

```text
Admin → Products → Content
   ├── Package image  (tarjeta Build your trip)   [ya existe]
   └── Landing image  (portada grande del producto) [nueva]

Portada del producto  →  landing_image_path  →  si no hay, usa image_path
```

## Sobre el SQL que pegaste

El fichero `20260923193000_product_landing_image_path.sql` **no existe** en
este proyecto (lo busqué). No hace falta ejecutar SQL a mano en Cloud ni
hacer commit/push: aplico la migración con la herramienta de migraciones de
Lovable, que crea la columna **y** regenera los tipos automáticamente. El
siguiente despliegue se basa en la base de datos real, no en ficheros sueltos.

## Migración (base de datos)

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS landing_image_path text;
```

- No se crea tabla nueva: `products` ya tiene sus GRANTs y políticas RLS, y
  la columna es solo lectura/escritura adicional.
- Las imágenes landing se guardan en el mismo contenedor privado
  `product-media` que ya existe y tiene sus políticas (Admin escribe,
  Staff lee, el servidor firma URLs para la web pública). No hace falta
  tocar Storage.

## Cambios de código

1. **`src/lib/catalog.ts`** — helper de ruta
   `productLandingImagePath(productId, fileName)` (mismo cubo, prefijo
   `landing-` para distinguirlas de las Package image).

2. **`src/lib/catalog.functions.ts`** — nueva función de servidor
   `setProductLandingImage` (solo ADMIN, validada con Zod, auditada en
   `admin_audit_log` como `product_landing_image_set` /
   `product_landing_image_removed`), que escribe `landing_image_path` y
   borra del Storage el archivo anterior si ya no lo usa nadie. Espejo de
   `setProductImage`. También, en `deleteProduct`, limpieza del
   `landing_image_path` igual que ya hace con `image_path`.

3. **`src/lib/public-catalog.server.ts`** — en `publicProductBundle`,
   leer también `landing_image_path` y devolver la URL firmada de la
   imagen landing; el campo `image_url` que recibe la portada pasa a ser
   `landingImage ?? packageImage` (fallback servidor). La función
   `listPurchasableProducts` (tarjetas de Build your trip) **no cambia**:
   sigue usando la Package image.

4. **`src/routes/admin/_app/products.$productId.tsx`** — generalizar
   `PackageImageEditor` para que acepte etiqueta, ruta y función de
   guardado, y añadir una segunda instancia "Landing image" justo debajo de
   "Package image" en la pestaña **Content**. Como `fetchProductBundle`
   hace `select("*")`, el nuevo `landing_image_path` llega solo tras la
   migración.

5. **`src/components/public/PackageLanding.tsx`** y la ruta
   `build-your-trip.$productId.index.tsx` — sin cambios: siguen usando
   `image_url`, que ahora llega ya resuelto (landing con fallback a
   package) desde el servidor.

## Qué NO cambia

- Tarjetas de *Build your trip* (siguen con la Package image).
- Precios, configurador, carrito, vouchers, pago, web pública.
- Contenedores de Storage ni sus políticas.
- Otras pantallas de Admin.

## Verificación

- Subir una landing image en Admin → Products → Content y verla en la
  portada pública del producto.
- Quitarla y comprobar que la portada vuelve a mostrar la Package image.
- Typecheck, tests y build limpios.
