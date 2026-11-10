# Conectar el proyecto a un contenedor de Storage (product-media)

## Contexto

El proyecto ya usa Supabase Storage (Lovable Cloud) con 4 contenedores privados creados
y con sus reglas de acceso (RLS) correctas:

- `accommodation-photos`
- `motorbike-photos`
- `website-media`
- `voucher-documents` (sin políticas RLS porque se lee/escribe solo con el
  cliente de servicio del servidor, que ignora RLS)

El código referencia un **quinto contenedor que no existe**: `product-media`
(`PRODUCT_MEDIA_BUCKET` en `src/lib/catalog.ts`). Se usa para la imagen de cada
producto/experiencia, que se sube y previsualiza en **Admin → Products →
(producto) → "Package image"** y se muestra en la web pública (vía URL firmada
generada por el servidor).

Como el contenedor no está creado, hoy no se puede subir la imagen del producto:
la subida falla y la previsualización tampoco carga.

## Qué se va a hacer

1. **Crear el contenedor `product-media`** con la herramienta de Storage (no por SQL):
   - Nombre: `product-media`
   - Privado (`public = false`): las imágenes se sirven por URL firmada, igual
     que el resto de contenedores del proyecto.
   - Límite de tamaño por archivo: `10MB` (coherente con `accommodation-photos`,
     que tiene ~10MB).

2. **Añadir reglas de acceso (RLS) sobre `storage.objects`** para ese contenedor,
   con una migración, replicando el patrón existente de `website-media` /
   `motorbike-photos`:
   - **SELECT** (leer / generar URL firmada): `authenticated` con
     `is_staff_or_admin()` — Admin y Staff pueden ver las imágenes.
   - **INSERT** (subir): `authenticated` con `is_admin()` (solo ADMIN).
   - **UPDATE**: `authenticated` con `is_admin()`.
   - **DELETE**: `authenticated` con `is_admin()`.

   Nota: la web pública lee la imagen del producto mediante el cliente de
   servicio del servidor (`supabaseAdmin`), que ignora RLS, por lo que no hace
   falta abrir lectura a usuarios anónimos. Las subidas desde Admin usan el
   cliente del navegador con la sesión del Admin, por eso necesitan las políticas
   anteriores.

## Qué NO cambia

- No se tocan los 4 contenedores existentes ni sus políticas.
- No se cambia el código: ya apunta a `product-media`. Solo falta el contenedor.
- No se modifica pricing, productos, configurador, carrito, vouchers ni la web.
- No se crea ningún sistema nuevo.

## Verificación

- Tras crear el contenedor y aplicar las políticas, en Admin → Products abrir un
  producto y subir una imagen: debe guardarse y verse la previsualización.
- Comprobar que la imagen aparece en la web pública donde se muestra el producto
  (URL firmada generada por el servidor).
- Confirmar que un usuario sin sesión no puede leer directamente del contenedor.
