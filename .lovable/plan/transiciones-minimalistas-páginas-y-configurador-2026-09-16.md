# Transiciones minimalistas: páginas y configurador

## Objetivo
Añadir dos transiciones muy sencillas, sin tocar el diseño ni usar librerías nuevas:
1. **Fundido suave** al cambiar de página (clics de menú).
2. **Deslizamiento direccional** entre preguntas del configurador (Siguiente entra desde la derecha, Atrás desde la izquierda).

No se modifica la lógica de precios, carrito, vouchers, pago, catálogos, configurador (salvo la capa visual de transición) ni el panel de Admin.

## Decisiones confirmadas
- Páginas → **Fundido suave** (~0.25s).
- Configurador → **Deslizamiento direccional** (~0.3s).
- Sin librerías (sin Framer Motion). Solo CSS + React state existente.
- Se respeta `prefers-reduced-motion`: si el usuario lo tiene activado, las animaciones se anulan (cambio instantáneo).

## Cambios

### 1. Animaciones en `src/styles.css`
Añadir (al final del archivo, CSS plano, sin tocar `@import` ni `@theme` existentes):
- `@keyframes cbr-fade-in`: opacity 0 → 1, 0.25s ease-out.
- `@keyframes cbr-step-next`: opacity 0 + translateX(24px) → 1 + 0, 0.3s ease-out.
- `@keyframes cbr-step-prev`: opacity 0 + translateX(-24px) → 1 + 0, 0.3s ease-out.
- Clases: `.cbr-page-enter`, `.cbr-step-next`, `.cbr-step-prev`.
- Bloque `@media (prefers-reduced-motion: reduce)` que anula las tres animaciones.

### 2. Transición de página en `src/routes/__root.tsx`
En `RootComponent`, leer el `pathname` actual con `useRouterState` y envolver `<Outlet />`:
- Si la ruta **no** empieza por `/admin`: envolver `<Outlet />` en un `<div key={pathname} className="cbr-page-enter">`. El `key` fuerza el remontaje solo al cambiar de ruta y reproduce el fundido.
- Si empieza por `/admin`: renderizar `<Outlet />` sin envoltorio (Admin queda intacto, sin remontajes extra que pudieran afectar a su estado).
- `<Toaster />` queda fuera del envoltorio animado.

### 3. Transición del configurador en `src/components/public/ConfiguratorForm.tsx`
- Añadir estado de dirección: `const [dir, setDir] = useState<1 | -1>(1)`.
- En el botón **Back**: `setDir(-1)` antes de `setStepIndex`.
- En el botón **Next**: `setDir(1)` antes de `setStepIndex`.
- Envolver únicamente el bloque de la pregunta (título + descripción + campos, aprox. líneas 218–436) en un `<div key={stepIndex} className={dir === 1 ? "cbr-step-next" : "cbr-step-prev"}>`.
  - El `key` reproduce la animación en cada cambio de pregunta.
  - Los botones Back/Next y la tarjeta de precio quedan fuera del envoltorio (no se deslizan).

## Lo que NO cambia
- Diseño, tipografía, colores, disposición ni contenido.
- Pricing, Cart, Vouchers, Payment, Products, Catalogues, Configurator logic, Routing, Website, Admin.
- Sin dependencias nuevas ni migración de base de datos.

## Verificación
- `bunx tsgo --noEmit` sin errores.
- `bunx vitest run` pasa (220 tests).
- Build OK.
- Comprobación con Playwright en `/`, `/home`, `/build-your-trip` y dentro de un producto:
  - Navegar entre páginas produce un fundido breve.
  - Avanzar/retroceder preguntas desliza en la dirección correcta.
  - Admin no se ve afectado.
