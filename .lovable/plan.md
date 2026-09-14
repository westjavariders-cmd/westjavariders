# Book individually: catálogos reservables directamente

Hoy "Book individually" es solo un destino de botón que lleva a la página `/pages/book-individually`
(una página web normal que creas en Admin → Website). Los bloques de página solo saben mostrar
**productos**, no catálogos, y los artículos de un catálogo (hotel, transporte, moto) solo se pueden
elegir dentro del configurador de un producto. Este plan añade la pieza que falta: mostrar catálogos
completos en esa página y que cada artículo se pueda **reservar y pagar directamente**, sin producto.

## Qué vas a poder hacer

1. En Admin → Website, al editar una página (por ejemplo "Book individually"), un **nuevo tipo de
   bloque "Catálogo"**: eliges uno de tus catálogos de la lista y el bloque muestra todos sus
   artículos activos (con foto, nombre y precio "desde"). Puedes añadir varios bloques de catálogo
   en la misma página, mezclados con los bloques que ya conoces.
2. En la web pública, cada artículo tiene botón **Reservar** que abre su propia página de reserva:
   - **Alojamiento**: eliges habitación y fechas (noches). Precio según la tarifa de la habitación.
   - **Transporte**: eliges personas y horas. Precio según sus tablas por personas/horas y el modo
     de cálculo (sumar o multiplicar) que ya configuraste.
   - **Moto**: eliges cantidad y días. Precio simple de la moto.
3. Al confirmar, la reserva entra en el **mismo carrito y el mismo pago con Xendit** que ya usan los
   paquetes: mismo botón "Pay now", mismo webhook, mismo pedido en Admin → Orders con su histórico
   inmutable. No se crea ningún sistema de pago nuevo.
4. Los precios los calcula el servidor con las tarifas que ya tienes metidas en cada catálogo;
   el cliente nunca puede alterarlos.

## Compatibilidad

- No se toca nada de productos, configurador, pricing, vouchers, FX ni del flujo de pago existente:
  la reserva directa se apoya en ellos.
- Las páginas y bloques web actuales siguen funcionando igual; "Catálogo" es un tipo de bloque más.
- Los botones que hoy apuntan a "Book individually" seguirán llevando a la misma página.

## Decisiones que propongo (confírmame si alguna no encaja)

- La reserva directa **no lleva seguro ni vouchers de regalo**: es una línea más del pedido.
- La reserva directa **sí genera voucher** como cualquier compra pagada (mismo PDF por email).
- El precio "desde" que se ve en la tarjeta es el precio base del artículo (habitación más barata /
  1 persona-1 hora / 1 moto-1 día), en la moneda que el visitante esté viendo.
- Disponibilidad: se acepta la reserva sin comprobación de aforo (como hoy con los paquetes);
  la gestión de plazas queda fuera de esta fase.

## Detalle técnico

- Migración: nuevo valor `catalogue` en el enum `website_block_kind` y tabla
  `website_block_catalogues` (block_id, catalogue_id, sort_order) con GRANT + RLS como el resto.
- `website.server.ts`: resolver los catálogos del bloque reutilizando `catalogue-bridge.server.ts`,
  devolviendo solo datos customer-safe (sin costes de proveedor).
- Admin: en `website.$pageId.tsx`, selector de catálogo para el nuevo bloque (patrón del selector
  ya usado en el configurador).
- Público: `WebsiteRenderer` renderiza tarjetas de artículos; nueva ruta
  `/book/$catalogueId/$itemId` con el formulario mínimo por plantilla.
- Reserva: nueva función de servidor que calcula el precio en el servidor y crea una línea de
  carrito "directa" (mismo `carts`/`cart_packages`, tipo de línea nuevo) para que checkout,
  snapshot, Xendit y Orders funcionen sin cambios de concepto.
- Tests: precio por plantilla (noches, personas×horas en ambos modos, moto), bloque con catálogo
  inactivo no muestra nada, y regresión del flujo de pago.

## Fuera de alcance

Disponibilidad/calendario de plazas, reserva de artículos sueltos elegidos a mano (el bloque es por
catálogo completo), cambios en vouchers o en el configurador.
