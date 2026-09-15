# Precio en la moneda del cliente durante la configuración

## Qué cambia para el cliente

1. En la tarjeta de precio de la configuración, encima del precio en rupias, aparece el mismo importe en la moneda elegida (por ejemplo "€120"), en grande, y el precio en rupias queda debajo en tamaño más pequeño como referencia.
2. Junto a ese precio hay el mismo desplegable de moneda que ya está arriba a la derecha. Los dos son el mismo control: cambiar en uno cambia también el otro y todos los precios de la web.
3. Mientras se recalcula, sigue mostrándose "Updating price…" como hasta ahora.
4. Si la moneda elegida es la rupia, o todavía no hay tipo de cambio configurado, solo se muestra el precio en rupias, sin duplicarlo.

## Detalle técnico

- El importe convertido lo calcula siempre el servidor; el navegador nunca multiplica ni divide.
- `src/lib/cart.functions.ts`: `savePackageConfiguration` devuelve, además de `quote`, un bloque de presentación con la moneda activa y el total convertido, usando `fxContext()` y `displayAmount()` de `@/lib/fx.server` dentro del handler. No se toca `cart.server.ts` ni el motor de precios.
- `src/components/public/SiteHeader.tsx`: se exporta el selector existente como `CurrencySelector` para reutilizarlo tal cual (misma llamada a `setFxCurrency` y misma invalidación de consultas), sin duplicar lógica.
- `src/components/public/ConfiguratorForm.tsx`: el tipo `Quote` gana los campos opcionales de presentación; la tarjeta de precio muestra el importe en moneda del cliente arriba con el selector al lado, y el importe en rupias debajo. Se reutiliza `displayTotal`/`formatCustomerAmount` ya existentes.
- Al cambiar de moneda, la invalidación de consultas ya existente refresca el mini carrito; en el configurador se vuelve a pedir la cotización para obtener el importe en la nueva moneda.
- Sin migración. Sin cambios en carrito, compras, vouchers ni Admin.

## Verificación

- Typecheck y suite de tests.
- Revisión con navegador: configurar una experiencia, comprobar los dos precios y que cambiar la moneda en el configurador actualiza también la cabecera y al revés.
