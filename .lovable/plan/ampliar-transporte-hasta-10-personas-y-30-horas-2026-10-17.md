# Ampliar transporte: hasta 10 personas y 30 horas

## Qué pasa ahora
La pantalla de precios del transporte ya muestra casillas de 1 a 10 personas y de 1 a 30 horas, pero la base de datos solo acepta hasta 7 personas y 14 horas. Por eso las casillas nuevas no se pueden guardar.

## Qué haré
Aplicar tu cambio tal cual (no hace falta que lo ejecutes tú en el editor SQL):
- Precios por personas: de 1 a 10.
- Precios por horas: de 1 a 30.
- Horas mínimas y máximas del transporte: de 1 a 30 (o vacías).

No se borra ni cambia ningún precio ya guardado.

## Después
Comprobaré que la base de datos acepta los nuevos límites. Luego tú rellenas en Admin → Transport las casillas de 8–10 personas y 15–30 horas y pulsas "Save prices".

## Detalles técnicos
Una migración con exactamente el SQL que enviaste (DROP/ADD de `transport_people_prices_people_range`, `transport_time_prices_hours_range`, `transports_min_hours_range`, `transports_max_hours_range`). El código (`src/lib/transport.ts`, `transport.functions.ts`) ya está preparado para 10/30; no cambia.
