# Borrar productos desde Admin → Products

## Qué verá el usuario

- En Admin → Products, cada producto tendrá un botón de papelera junto al de duplicar (solo para ADMIN, como el resto de acciones).
- Al pulsarlo, un diálogo pide confirmación con el nombre del producto ("Delete product …? This cannot be undone").
- Si el producto nunca se ha usado (no hay carritos, pedidos ni vouchers asociados), se borra por completo y desaparece de la lista.
- Si el producto ya fue configurado o comprado alguna vez, el borrado se rechaza con un mensaje claro que propone archivarlo en su lugar, con botón "Archive instead" que cambia su estado a archived en el mismo diálogo.

## Cómo funciona por dentro

- La base de datos ya está preparada: todo lo que cuelga del producto (traducciones, componentes, configurador, precios, temporadas, relaciones con categorías/placements/web) se borra en cascada con el producto.
- La única referencia con restricción es `packages.product_id` (configuraciones/pedidos/vouchers históricos): la base de datos la protege con RESTRICT, y eso es lo que impide borrar un producto con historial. Por eso el flujo "archivar en su lugar".
- Nueva función de servidor `deleteProduct` en `src/lib/catalog.functions.ts`, siguiendo el patrón existente: solo ADMIN, auditoría `product.deleted` en `admin_audit_log`, mensajes de error seguros.
- Nueva función `archiveProduct` o reutilización de `setProductStatus` si ya existe para el fallback "Archive instead".
- Cambios en `src/routes/admin/_app/products.index.tsx`: botón de papelera, diálogo de confirmación con estado de error que ofrece archivar, refresco de la lista tras borrar/archivar.

## Lo que NO se toca

- No se borran ni modifican paquetes, pedidos, pagos, vouchers ni snapshots históricos (por eso el borrado con historial se bloquea y se ofrece archivar).
- Nada de la web pública, carrito, precios ni configurador.
- Sin migración de base de datos: las reglas de borrado ya existen.

## Verificación

- Borrar un producto de prueba sin historial: desaparece de la lista y queda auditado.
- Intentar borrar un producto con historial: se rechaza y el botón "Archive instead" lo archiva.
- Un usuario Staff no ve el botón de borrado.
- Typecheck, tests y build limpios.
