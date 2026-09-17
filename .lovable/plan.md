# Dos cosas: la tarjeta que no se puede pinchar y el cambio de idioma

## 1. Por qué no se puede pinchar "Begginers: Cimaja, Cikembang and more surprises"

La experiencia está activa, pero **sus precios están en borrador** (se cambiaron ayer a las 22:27). Cuando los precios no están activos, la web muestra la tarjeta apagada con el aviso "Not available for booking right now" y no deja pulsarla. "Intermediates and Pros" sí tiene los precios activos, y por eso esa sí se puede pinchar.

No es un fallo de programación: es el estado de los precios de esa experiencia.

**Solución, sin tocar el código:**

1. Admin → Products → "Begginers: Cimaja, Cikembang and more surprises".
2. Abrir la pestaña de precios (Pricing).
3. Pulsar **Activate pricing**.
4. Volver a la web y comprobar que la tarjeta ya lleva al configurador.

Puedo activarlo yo si me lo confirmas, o lo pulsas tú desde Admin.

## 2. ¿Hay algo preparado para cambiar de idioma en la web?

A medias:

- **Sí está preparado por debajo.** Hay 8 idiomas activos (inglés como principal, más chino, japonés, indonesio, filipino, tailandés, español y portugués de Brasil), y en Admin puedes escribir los textos de cada página, sección, bloque y menú en cualquiera de ellos. Cuando falta una traducción, se muestra el inglés.
- **No hay todavía un selector de idioma para el visitante.** La web pública siempre pide los textos en el idioma principal, así que aunque traduzcas en Admin, el cliente sigue viendo inglés.

**Lo que faltaría para que funcione (si lo quieres, en un segundo paso):**

- Un selector de idioma en la barra superior, junto al de moneda, con el mismo estilo discreto.
- Recordar el idioma elegido (como ya se hace con la moneda) y pasarlo a las páginas, al menú y a la pantalla de entrada.
- Los textos fijos de la web (botones como "Add to cart", avisos del carrito) seguirían en inglés en esta primera versión; traducirlos sería un trabajo aparte y más grande.

Dime si quieres que lo prepare y hago un plan solo para eso.

## No se toca

Precios, productos, catálogos, configurador, carrito, pagos, vouchers ni Admin.
