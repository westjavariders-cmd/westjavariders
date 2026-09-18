# Selector de idioma arriba en la web (y la tarjeta que no se puede pinchar)

## 1. Antes de nada: no he tocado nada del idioma

No he hecho ningún cambio todavía. Lo que veas ahora mismo es como estaba.

## 2. Por qué no se puede pinchar "Begginers: Cimaja, Cikembang and more surprises"

La experiencia está activa, pero **sus precios están en borrador**. Cuando los precios no están activos, la web muestra la tarjeta apagada con el aviso "Not available for booking right now" y no deja pulsarla. "Intermediates and Pros" sí tiene los precios activos, y por eso esa sí se puede pinchar.

No es un fallo de programación. Se arregla en Admin → Products → esa experiencia → pestaña de precios → **Activate pricing**. Dime si quieres que lo active yo.

## 3. Selector de idioma en la parte superior

Ya tienes 8 idiomas activos (inglés como principal, más chino, japonés, indonesio, filipino, tailandés, español y portugués de Brasil) y en Admin puedes escribir los textos de cada página, sección, bloque y menú en cualquiera de ellos. Lo que falta es el selector para el visitante.

Lo que haré:

- Un desplegable de idioma en la barra superior, **justo al lado del de moneda**, con el mismo estilo discreto (EN, ES, JA…).
- Al elegir un idioma, la web vuelve a pedir los textos en ese idioma: páginas, secciones, bloques, menú y pantalla de entrada. Si a algún texto le falta traducción, se muestra el inglés, como ahora.
- **"Recordar el idioma elegido"** simplemente significa que si eliges español y luego navegas a otra página o vuelves más tarde, sigue en español sin tener que elegirlo otra vez. Funciona igual que la moneda: se guarda en el navegador del visitante. Si prefieres que no se recuerde y vuelva siempre a inglés, dímelo.
- **"West Java Riders" no se traduce nunca**: el nombre de la marca en la cabecera se queda siempre igual, en todos los idiomas.

## 4. Lo que seguirá en inglés por ahora

Los textos fijos de la web que no vienen de Admin (botones como "Add to cart", avisos del carrito, formulario de contacto) seguirán en inglés. Traducir esos es un trabajo aparte y bastante mayor; si lo quieres, lo hacemos en un paso siguiente.

## Detalle técnico

- Guardado de la elección con una cookie propia y una función de servidor `setSiteLanguage`, siguiendo el patrón que ya usa la moneda (`setFxCurrency` / `selectCurrency`).
- Las lecturas públicas (`websitePage`, `websiteNav`, `websiteLanding`) ya aceptan un idioma; se les pasará el elegido en lugar de dejar el idioma por defecto.
- Nuevo `LanguageSelector` en `SiteHeader.tsx` junto a `CurrencySelector`, alimentado por los idiomas activos.
- Sin migración de base de datos.

## No se toca

Precios, productos, catálogos, configurador, carrito, pagos, vouchers, Admin ni el nombre de la marca.
