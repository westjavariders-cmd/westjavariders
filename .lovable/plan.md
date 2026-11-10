# Auditoría de infraestructura y pasos para salir de Lovable (solo lectura, nada cambiado)

## Respuestas
1. **Conexión**: la app usa **Lovable Cloud**, no un proyecto Supabase externo. Por debajo es Supabase gestionado por Lovable, así que no tienes acceso directo a su panel ni a la clave de servicio.
2. **Dónde están los datos**: todo está en la base de datos de Lovable Cloud (65 tablas).
   - Productos y catálogos: productos, traducciones y catálogos.
   - Configuraciones y precios: pasos, preguntas, opciones, precios, temporadas, códigos promocionales y tipos de cambio.
   - Experiencias y transportes: alojamientos, habitaciones, transportes con precios por personas y horas, y motos.
   - Usuarios y autenticación: el inicio de sesión de Admin/Staff usa la autenticación de Lovable Cloud, y los roles están en su tabla. Los clientes no tienen cuenta, pero sus datos se guardan con sus compras.
   - Páginas y navegación: páginas, secciones, bloques, menú y portada, con sus traducciones.
   - Además: carritos, compras, pagos, vouchers, consultas de contacto, viajes compartidos y registro de actividad.
3. **Imágenes y archivos**: en el almacenamiento de Lovable Cloud, en 5 contenedores privados: fotos de alojamiento, fotos de motos, imágenes de producto, imágenes de la web y PDFs de vouchers.
4. **Qué depende de Lovable**:
   - La base de datos, la autenticación y el almacenamiento.
   - El alojamiento y la publicación: la web se ejecuta en Cloudflare a través de Lovable, y el aviso de pago de Xendit entra por la web.
   - El envío de emails usa la clave de Lovable (aún no está activo).
   - La configuración de compilación de Lovable y su informe de errores.
   - Xendit no depende de Lovable: es tu cuenta y tus claves.
5. **¿Puede funcionar fuera con GitHub + Supabase + Cloudflare?** Sí. La web ya está hecha para Cloudflare y usa Supabase normal. Solo habría que sustituir dos cosas: los emails (por ejemplo, con Resend o similar) y la configuración de compilación de Lovable, que pasaría a una estándar.

## Qué migrar antes de dejar Lovable
1. **Código**: conectar el proyecto a GitHub (Ajustes → GitHub) para tener el código completo.
2. **Base de datos**: crear tu propio proyecto Supabase, aplicar la estructura (58 migraciones en el código) y exportar e importar todos los datos.
3. **Usuarios Admin/Staff**: las contraseñas no se pueden exportar, así que habría que recrear las cuentas o enviar un enlace para que pongan una nueva. Después se recrean sus roles.
4. **Archivos**: descargar los 5 contenedores y subirlos con las mismas rutas.
5. **Secretos**: las claves de Xendit y las nuevas claves de Supabase en Cloudflare. Cambiar en Xendit la dirección del aviso de pago a la nueva web.
6. **Emails**: cambiar el envío a otro proveedor con tu dominio.
7. **Despliegue**: Cloudflare Workers conectado a GitHub, y el dominio apuntando ahí.
8. **Prueba completa** antes de apagar Lovable: compra, pago, voucher, contacto y Admin.

## Conclusión
Hoy la web funciona así: código TanStack Start alojado por Lovable sobre Cloudflare, más Lovable Cloud (Supabase gestionado) para datos, inicio de sesión y archivos, y Xendit para los pagos. Independizarse es viable. El trabajo principal es mover los datos y los archivos a tu propio Supabase y cambiar el envío de emails.
