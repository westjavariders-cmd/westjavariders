# Nombre y desglose del paquete en el voucher

## Objetivo

Que cada producto pueda llevar el nombre que quieres que aparezca al cliente, en el pedido del admin y en el voucher, y que el voucher muestre por cada paquete: nombre, precio base, sumas parciales del cálculo de precio y total, además de lo que el cliente eligió al configurar la experiencia, con las etiquetas reales de las preguntas.

Nada se borra: se añaden campos y se enriquece la presentación. Los precios, las reglas y las fórmulas no se tocan.

## Qué cambia para ti

1. En la ficha del producto, pestaña Configurator, aparece un campo nuevo: **Nombre visible (voucher y carrito)**. Si lo dejas vacío, se sigue usando el título actual del producto, como hasta hoy.
2. Ese nombre se usa en el carrito, en el pedido del admin y en el voucher (PDF y email), de forma coherente.
3. El voucher muestra, por cada paquete contratado:
   - el nombre visible del paquete
   - **Precio base**
   - las **sumas parciales** que ya calcula el motor de precios (una línea por concepto, con su importe)
   - **Total del paquete**
   - las opciones elegidas por el cliente, con la etiqueta real de cada pregunta (por ejemplo "Número de días: 5" en vez de "Choosenumberofdays: 5")
4. Los vouchers ya emitidos no cambian: su contenido está congelado por diseño. Los nuevos ya salen con el formato completo.
5. En vouchers de regalo se sigue ocultando el precio, como ahora.

## Detalles técnicos

**Base de datos (una migración, solo aditiva)**
- `products.voucher_name text` (nullable). Sin cambios de RLS ni de permisos: hereda los de la tabla.

**Título visible**
- `src/lib/purchase.server.ts` → `revalidateCart`: la consulta de `products` pasa a `select("id, internal_name, voucher_name")` y el título se resuelve como `voucher_name || translation.title || internal_name`. Al usarse en `RevalidatedPackage.product_title`, el nuevo nombre llega automáticamente al carrito, al snapshot y al voucher.
- `src/lib/public-catalog.server.ts` (`publicCart`) usa la misma prioridad para que el carrito público coincida.

**Snapshot (histórico, sigue inmutable)**
- `buildSnapshot` añade por paquete: `base_price_idr` y mantiene `quote_lines` (que ya contiene `label`, `detail`, `amount_idr_exact`, incluida la línea base). Se añade `option_labels`: pares etiqueta/valor construidos con la etiqueta real de cada pregunta activa del configurador (leída junto al quote) en vez del nombre de variable.
- `base_price_idr` proviene de `product_pricing.base_amount_idr` para líneas de producto y de 0/null para reservas directas de catálogo.

**Voucher**
- `src/lib/voucher.ts` → `VoucherEntitlementItem` gana `base_price_idr: number | null`, `breakdown: { label: string; amount_idr: number }[]` y `total_idr: number | null`; `optionLabels` pasa a leer `option_labels` del snapshot cuando existe, con el comportamiento actual como respaldo para snapshots antiguos.
- `src/lib/voucher-pdf.server.ts` y `src/lib/voucher-delivery.ts` imprimen precio base, líneas del desglose y total bajo cada paquete; en vouchers GIFT se omiten todos los importes, igual que hoy.

**Admin**
- `src/components/admin/configurator/ConfiguratorTab.tsx`: campo de texto para `voucher_name`, guardado con la función de actualización de producto ya existente en `src/lib/catalog.functions.ts`.

**Verificación**
- `bunx tsgo --noEmit`, `bunx vitest run` (incluye tests nuevos de desglose y de nombre visible) y revisión del log de build.
