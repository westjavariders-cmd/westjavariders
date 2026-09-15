# Usar en el voucher los nombres definidos en cada catálogo

## Objetivo
En cada respuesta del voucher, sustituir las etiquetas genéricas **People** y **Hours** por los nombres configurados en el catálogo correspondiente:

- **Name shown for the number of people**
- **Name shown for the duration in hours**

Cada variable conservará así su propio nombre. Por ejemplo, un catálogo podrá mostrar **Number of boards / Number of days** y otro **Number of people / Number of sessions**.

## Cambios
- Conservar junto a cada selección de catálogo sus dos nombres de cantidad, además del artículo y las cantidades elegidas.
- Al construir el resumen ordenado del cuestionario, usar los nombres del catálogo de esa pregunta en vez de las etiquetas generales **People** y **Hours**.
- Mantener el mismo orden actual: pregunta del catálogo, cantidad de personas, duración.
- Aplicar el resultado común al voucher del cliente, PDF, email y vistas del administrador que ya consumen ese resumen.
- Mantener **People**, **Hours**, **Days** y **Nights** solo como respaldo cuando una respuesta antigua no pueda relacionarse con un catálogo.
- Para vouchers anteriores, recuperar los nombres desde el catálogo relacionado cuando todavía exista, sin modificar el pedido ni su copia histórica.

## Enfoque técnico
- No hace falta cambiar la estructura de la base de datos: los campos `people_label` y `hours_label` ya existen en los catálogos.
- Ampliar los datos históricos de nuevas selecciones para congelar ambos nombres en pedidos futuros.
- Hacer que el generador único de respuestas ordenadas acepte etiquetas específicas por variable y sufijo.
- Añadir pruebas con varios catálogos que usan nombres distintos, incluyendo pedidos nuevos y anteriores.

## Fuera de alcance
- No cambiar precios, fórmulas, cantidades elegidas, orden del configurador ni contenido de los catálogos.
- No borrar ni reescribir pedidos o vouchers existentes.
