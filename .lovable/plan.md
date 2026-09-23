# Ampliar "other location" a 7 personas y 14 horas (reintento guiado)

## Contexto (verificado en tus datos)

Tus cambios anteriores no llegaron a guardarse: todas las opciones "other location" siguen con máximo 4 personas y 9 horas, y el registro de actividad no muestra ningún guardado desde el 17 de septiembre. El configurador muestra exactamente lo guardado en la ficha de cada transporte; no hay ningún límite de 4/9 en el código (los máximos ya son 7 y 14).

## Qué haremos

1. **Tú**: en Admin → Transport, abre cada opción "other location", rellena las casillas 5, 6 y 7 personas y 10 a 14 horas con sus precios y pulsa **Save prices**. Debe aparecer el aviso "Prices saved." — si sale un aviso rojo, dímelo tal cual.
2. **Yo**: en cuanto lo hagas, verifico que las casillas quedaron guardadas y que el configurador ofrece 1–7 personas y 1–14 horas en cada opción. Si el guardado falla, investigo y corrijo la causa.
3. **Yo**: corrijo el texto desactualizado de la pantalla de precios, que dice "Travel time from 1 to 9 hours" cuando el límite real es 14 (`src/components/admin/transport/TransportPricing.tsx`).

## Detalle a tener en cuenta

"Save prices" guarda **todas** las casillas de la 1 a la 7 (y de la 1 a la 14), incluidas las que queden a 0 — y todas aparecen en el configurador. Si alguna casilla no debe ofrecerse, avísame.
