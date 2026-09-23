# Ampliar "other location" a 7 personas y 14 horas en el configurador

## Qué está pasando (verificado en tus datos)

Tus cambios no llegaron a guardarse. El configurador muestra exactamente las casillas de precio guardadas en la ficha de cada transporte, y ahí **todas** las opciones "other location" siguen con máximo 4 personas y 9 horas. El registro de actividad del panel confirma que no hubo ningún guardado desde el 17 de septiembre, así que el "Save prices" no se completó (o falló con un aviso que pasó desapercibido).

## Qué haré

1. **Comprobar el guardado de punta a punta**: con un transporte de prueba, rellenar personas 5–7 y horas 10–14 en Admin → Transport, pulsar "Save prices" y confirmar que quedan guardadas y aparecen en el configurador. Después borro el transporte de prueba. Si el guardado falla, corrijo la causa.
2. **Corregir un texto desactualizado**: la pantalla de precios dice "Travel time from 1 to 9 hours" aunque el límite real ya es 14; pasará a decir 14.
3. **Aplicar tus precios**: cuando me pases los precios de cliente de las casillas nuevas (5, 6 y 7 personas; 10 a 14 horas) para cada opción "other location", los introduzco en todas y verifico que el configurador ofrece 1–7 personas y 1–14 horas en cada una.

## Detalles técnicos

- El configurador construye las opciones de personas/horas a partir de las filas de `transport_people_prices` y `transport_time_prices` (`src/lib/catalogue-bridge.server.ts`); no hay ningún límite de 4/9 en el código: las constantes ya son 7 y 14.
- Ojo con un detalle del guardado actual: "Save prices" escribe **todas** las casillas de la 1 a la 7 (y de la 1 a la 14), incluidas las que queden a 0. Es decir, tras guardar, todas aparecen en el configurador; si alguna no debe ofrecerse, hay que decírmelo.
- Cambio de texto en `src/components/admin/transport/TransportPricing.tsx`.
- Verificación: typecheck, tests y una comprobación en navegador de que el configurador muestra 7 personas y 14 horas.

## Pendiente de ti

- Los precios de cliente para las casillas nuevas (5–7 personas y 10–14 horas) de cada opción "other location".
