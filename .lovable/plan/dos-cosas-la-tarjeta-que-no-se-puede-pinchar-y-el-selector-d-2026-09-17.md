# Dos cosas: la tarjeta que no se puede pinchar y el selector de idioma

## 1. Por qué no se puede pinchar "Begginers: Cimaja, Cikembang and more surprises"

La experiencia está activa, pero **sus precios están en borrador** (se cambiaron ayer a las 22:27). Cuando los precios no están activos, la web muestra la tarjeta apagada con el aviso "Not available for booking right now" y no deja pulsarla. "Intermediates and Pros" sí tiene los precios activos, y por eso esa sí se puede pinchar.

No es un fallo de programación: es el estado de los precios de esa experiencia.

**Solución, sin tocar el código:** Admin → Products → esa experiencia → pestaña de precios → **Activate pricing**. Puedo activarlo yo si me lo confirmas.

## 2. Selector de idioma en la parte superior

Estado actual: hay 8 idiomas activos (inglés como principal, más chino, japonés, indonesio, filipino, tailandés, español y portugués de Brasil) y en Admin ya puedes escribir los textos de cada página, sección, bloque y menú en cualquiera de ellos. Lo que falta es que el visitante pueda elegir su idioma; hoy la web siempre pide el idioma principal.

Lo que haré:

- Un **selector de idioma en la barra superior**, junto al de moneda y con el mismo estilo discreto (lista corta con los idiomas activos).
- Al elegir un idioma, la página, el menú y la pantalla de entrada se vuelven a cargar con los textos escritos en Admin para ese idioma. Si algún texto no está traducido todavía, se muestra el inglés.
- **"Recordar el idioma elegido"** significa que, al cambiar de página o volver más tarde, la web sigue en el idioma que eligió, sin tener que seleccionarlo otra vez. Igual que ya ocurre con la moneda.
- El nombre **West Java Riders** se queda siempre igual, no se traduce.
- Los textos fijos de la aplicación (botones como "Add to cart", avisos del carrito y del configurador) siguen en inglés en esta primera versión: traducirlos es un trabajo aparte y mucho mayor.

## Detalles técnicos

- Nueva preferencia de idioma del visitante guardada como la moneda: una función de servidor que la fija y una cookie, para que también funcione en la primera carga (SSR).
- `websitePage`, `websiteNav` y `websiteLanding` ya aceptan idioma; las páginas públicas (`pages.$slug`, `home`, `index`) y `SiteHeader` pasarán el idioma elegido.
- Componente `LanguageSelector` junto a `CurrencySelector` en `SiteHeader.tsx`, alimentado por la lista de idiomas activos leída en servidor; al cambiar se invalidan las consultas para recargar los textos.
- Sin migraciones de base de datos y sin sistema de traducción paralelo.

## No se toca

Precios, productos, catálogos, configurador, carrito, pagos, vouchers, Admin ni el diseño actual.
