# Web pública en negro y blanco

## Objetivo

Dar a toda la experiencia pública el mismo carácter negro y blanco de la pantalla de entrada, manteniendo el panel de administración con su aspecto actual.

## Cambios

- Aplicar un tema oscuro exclusivo a la web pública: fondo negro, texto blanco, textos secundarios grises y bordes discretos.
- Mantener la cabecera, el menú móvil, el selector de moneda y el acceso al carrito legibles sobre el fondo negro.
- Adaptar tarjetas, formularios, desplegables, botones, avisos y estados de compra para conservar contraste y claridad.
- Cubrir Home, páginas configuradas, Build Your Trip, configurador, reservas individuales, carrito y página del pedido.
- Mantener la pantalla de entrada como está y no cambiar el Admin.

## Enfoque técnico

- Crear una capa de tema público con variables semánticas, evitando colores sueltos en cada pantalla.
- Activar esa capa desde el contenedor compartido de las páginas públicas, de modo que los componentes existentes hereden el nuevo aspecto.
- Ajustar únicamente los elementos públicos que no hereden correctamente los colores del tema.
- Comprobar visualmente en móvil y escritorio las páginas principales, los formularios y el carrito, además de verificar que el Admin sigue claro y sin cambios.

## Fuera de alcance

- No se modifica contenido, navegación, precios, lógica de reservas, pagos ni datos.
- No se rediseña la estructura de las páginas; solo cambia la presentación cromática.
