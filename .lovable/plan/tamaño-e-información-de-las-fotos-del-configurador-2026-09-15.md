# Tamaño e información de las fotos del configurador

## Resultado

En cada pregunta conectada a un catálogo se podrá elegir en Admin el tamaño de presentación de sus fotografías: **Pequeño, Mediano o Grande**.

El cambio ajustará únicamente el ancho de la galería. Se conservarán exactamente su proporción 4:3, recorte, borde, esquinas, flechas, puntos y contador actuales.

Al seleccionar un artículo, debajo de su fotografía aparecerá la información pública que esté rellenada en su ficha de catálogo. Los campos vacíos no dejarán huecos.

## Información visible

- **Habitaciones:** nombre público, descripción, capacidad máxima y precio público.
- **Transportes:** nombre público, descripción, origen, destino, duración disponible, nombres de las cantidades configuradas y precio público correspondiente a las opciones.
- **Motos y artículos simples:** nombre público, descripción y precio público.
- Nunca se expondrán nombres o referencias internas, costes del proveedor, contactos, notas internas ni otros datos administrativos.

El nombre y el precio que ya aparecen en el botón no se repetirán innecesariamente junto a la galería; el bloque ampliado mostrará los demás datos públicos útiles.

## Comportamiento

1. El tamaño se configura dentro de cada pregunta del configurador del producto.
2. Las preguntas existentes conservarán **Grande**, equivalente a la visualización actual.
3. Si una pregunta permite varias opciones, la foto y la información serán las de la última opción marcada; al desmarcarla, volverán a la última que siga elegida.
4. Si el artículo no tiene foto, no aparecerá marco vacío, pero sí su información pública.
5. Las opciones manuales seguirán sin galería ni información de catálogo.

## Cambios técnicos

- Añadir a cada pregunta un ajuste validado de tamaño de galería (`small`, `medium`, `large`), con `large` como valor predeterminado.
- Incorporar el selector **Photo size** en la edición de preguntas conectadas a catálogo y guardar el valor junto al resto de la pregunta.
- Conservar ese ajuste al duplicar un producto y su configurador.
- Ampliar el puente de catálogo únicamente con datos públicos y seguros, normalizados como etiquetas y valores para cada tipo de catálogo.
- Actualizar la galería pública para aplicar un ancho máximo según el tamaño elegido sin modificar su proporción ni el tratamiento de la imagen.
- Mostrar los detalles del mismo artículo que controla la galería, también en selecciones múltiples y aunque no tenga fotografía.
- Añadir pruebas del filtrado de datos internos, tamaños permitidos, valor predeterminado y selección múltiple; verificar visualmente en móvil y escritorio.

No se cambiarán precios, fórmulas, respuestas, orden de preguntas, vouchers ni la edición de las fichas de catálogo.
