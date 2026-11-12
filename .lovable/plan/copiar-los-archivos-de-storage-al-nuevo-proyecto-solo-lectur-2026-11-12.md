# Copiar los archivos de Storage al nuevo proyecto (solo lectura)

## Respuestas
- **¿Credencial temporal de lectura?** No. Lovable Cloud no entrega la clave de servicio ni credenciales de acceso directo, ni permanentes ni temporales.
- **¿URLs firmadas?** Sí. El servidor de la web puede generar enlaces firmados de descarga para cualquier archivo privado, con caducidad corta.
- **¿Procedimiento temporal?** Sí: se crea una herramienta de exportación temporal, solo para ADMIN, que genera la lista de todos los archivos con su enlace de descarga.
- **Limitaciones:** desde fuera no hay acceso directo al Storage (ni S3 ni panel de control). Solo es posible a través de la web con un usuario ADMIN. Los enlaces caducan (1 hora). La exportación de la base de datos no incluye los archivos.

## Lo que se construye
1. Una página nueva en Admin, **Admin → Export files**, visible solo para ADMIN.
2. Un botón "Generate download list" que recorre los 5 contenedores (accommodation-photos, voucher-documents, motorbike-photos, website-media, product-media), incluidas las subcarpetas, y descarga un archivo `storage-manifest.json` con: contenedor, ruta exacta, tamaño, tipo y enlace firmado válido 1 hora.
3. Un script listo para copiar (se muestra en la misma página) que el usuario ejecuta en su ordenador:
   - lee el manifiesto,
   - descarga cada archivo,
   - lo sube al nuevo proyecto en el **mismo contenedor y la misma ruta**, usando la clave de servicio del **nuevo** proyecto (esa sí la tiene el usuario),
   - al final compara el total (132) y avisa de cualquier fallo para reintentarlo.

## Pasos para el usuario
1. En el nuevo proyecto, crear los 5 contenedores privados con los mismos nombres.
2. Entrar en Admin → Export files y pulsar "Generate download list".
3. Ejecutar el script antes de 1 hora (si caduca, volver a generar la lista).
4. Comprobar que el recuento coincide.
5. Cuando todo esté copiado, pedir que se elimine la página temporal.

## Garantías
- No se modifica, mueve ni borra ningún archivo ni ajuste del proyecto original: solo lectura.
- Los enlaces solo se generan para un ADMIN con sesión iniciada; nunca se publican.
- El contenedor `database_export_10_11_26` (la exportación de la base de datos) no se incluye; se descarga aparte desde More → Storage.

## Detalles técnicos
- Server function `exportStorageManifest` (requireSupabaseAuth + comprobación `is_admin`), usa `supabaseAdmin` cargado dentro del handler: `storage.from(b).list(prefix, {limit:1000})` recursivo y `createSignedUrls(paths, 3600)`.
- Ruta `src/routes/admin/_app/export-files.tsx`.
- Script Node (`@supabase/supabase-js`) con variables `NEW_SUPABASE_URL` y `NEW_SERVICE_ROLE_KEY`, `upload(path, blob, {contentType, upsert:false})`.
- Sin migraciones de base de datos.
