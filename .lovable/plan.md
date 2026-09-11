# Investigación READ-ONLY — Precio de un Component dependiente de DOS variables

Caso: SURF LESSON, tarifa determinada por (People × Sessions per Day) y luego multiplicada por Number of Days. No se ha modificado nada.

## 1. Cómo funcionan hoy los tiers

Tabla `pricing_tiers` (migración `20260907190520...`): `rule_id`, `from_value`, `to_value` (null = abierto), `amount_idr`, `display_order`.

En `src/lib/pricing.ts`, caso `"tier"` de `priceProduct`:
- lee **una sola** variable: `numberInput(inputs, rule.variable_name)`
- busca el primer tramo de `pricing_tiers` cuyo rango `from_value`/`to_value` contiene ese valor
- aporta `match.amount_idr` como importe total del tramo (no por unidad, no marginal)

## 2. Cuántas variables determinan un tier

Exactamente **una**: `pricing_rules.variable_name`. No hay segunda columna de variable ni segundo rango en `pricing_tiers`.

## 3. ¿Puede un tier depender de dos variables?

No directamente. Lo más cercano hoy: `pricing_rules.condition_variable` / `condition_operator` / `condition_value` (evaluado por `conditionHolds`), que existe en los tipos de regla `component_quantity` y `conditional`, **pero el caso `tier` no evalúa la condición** — el `switch` de `tier` va directo a `variable_name`. Así que una regla de tier no se puede restringir por una segunda variable.

## 4. ¿Existe estructura multidimensional?

No. No hay matriz de precios, ni tabla de combinaciones, ni clave compuesta. Tipos de regla existentes (`PRICING_RULE_TYPES`): `fixed`, `variable_times_amount`, `component_quantity`, `conditional`, `tier`.

## 5. ¿Se puede conseguir con `pricing_rules` / `variable_times_amount` sin tocar el Pricing Core?

Sí, por combinatoria, sin cambios de código:
- `conditional`: importe fijo cuando una variable cumple una condición → una regla por combinación (People=1 & Sessions=1, etc.). Limitación: `conditionHolds` compara **una** variable por regla, así que una combinación de dos variables necesita el patrón de abajo.
- Patrón viable hoy: una regla `tier` sobre People **por cada** valor de Sessions per Day, y como el tier no admite condición, la separación por sesiones debe hacerse con **fórmula** (punto 6) o con `variable_times_amount` cuando la tarifa sea lineal (`tarifa = sessions × importe × ...`).
- `component_quantity` multiplica el `customer_price` del componente por **una** cantidad: `unit_basis` (mapeada a `people_variable` / `days_variable` / `nights_variable` / `sessions_variable` en `product_pricing`) o el override `pricing_rules.quantity_variable`. Nunca por dos a la vez.

## 6. ¿Puede una fórmula seleccionar tarifa según People + Sessions?

Sí. El evaluador (`evaluateFormula`, tokenizer + parser propio) soporta `IF(cond, a, b)` anidado, `MIN`, `MAX`, `CONTAINS`, comparaciones y `+ - * /`. Por tanto:

```text
IF(people <= 1, IF(sessions == 1, A, B),
IF(people <= 2, IF(sessions == 1, C, D), IF(sessions == 1, E, F))) * days
```

es una fórmula válida hoy: una tabla de tarifas expresada como `IF` anidados. Las fórmulas no son solo aritmética; sí son solo expresiones (sin tablas, sin lookups, sin bucles).

## 7. ¿(tarifa por People + Sessions) × Days?

Sí, **en modo fórmula**, con la expresión anterior. Límites conocidos: `MAX_EXPRESSION_LENGTH = 2000` caracteres y `MAX_DEPTH = 32` de anidamiento.

En modo `structured` no es posible en una sola regla: ninguna regla multiplica una tarifa seleccionada por una tercera variable.

## 8. Limitación concreta

- `mode = "formula"` es **excluyente**: `priceProduct` devuelve solo el resultado de la fórmula e **ignora** `base_amount_idr`, todas las `pricing_rules` y las entradas de componentes. Si el producto ya usa reglas estructuradas (componentes de Media, Accommodation, etc.), pasarlo a fórmula obliga a reescribir todo el precio dentro de la fórmula.
- El precio del componente SURF LESSON (`product_components.customer_price`) no se usaría: las tarifas irían escritas como números dentro de la fórmula, y editarlas exige crear una nueva `formula_versions` (la versión activa es inmutable).
- Mantenimiento: con 8 personas × 3 opciones de sesiones son 24 ramas `IF` a mano.
- `tier` no acepta condición, así que la vía estructurada "una tabla de tiers por número de sesiones" no está disponible sin cambios de código.

## Qué se puede hacer HOY

1. Modo fórmula con `IF` anidados × `days` — funciona ya, sin migración; coste: reescribir el precio completo del producto en la fórmula.
2. Modo estructurado, si la tarifa es descomponible (p. ej. precio por persona-sesión constante): `component_quantity` con `quantity_variable`, o `variable_times_amount`, y `days` como base multiplicadora mediante `unit_basis = per_day`.
3. Modo estructurado con matriz real de tarifas People × Sessions: **no soportado hoy**.
