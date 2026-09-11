# Catálogos ilimitados a partir de 3 plantillas

Sí, es sencillo: la base de datos ya está preparada. Existe una tabla de catálogos con
plantilla (alojamiento / transporte / motos), y hoteles, transportes y motos ya tienen un
campo que dice a qué catálogo pertenecen. Lo que falta es la parte visible: crear catálogos
desde Admin, separar sus artículos y poder elegir un catálogo concreto en el configurador.

## Qué vas a poder hacer

1. En Admin, una sección **Catálogos** con la lista de todos tus catálogos.
2. Botón **Nuevo catálogo**: pones nombre interno, nombre público, descripción y eliges una
   de las 3 plantillas existentes:
   - Alojamiento (con habitaciones, características y fotos)
   - Transporte (precios por personas y por horas)
   - Motos (precio simple con foto)
3. Al abrir un catálogo, ves y gestionas **solo sus artículos**, con exactamente las mismas
   pantallas que usas hoy en Hoteles, Transporte y Motos. Ejemplo: un catálogo "Clases de
   surf iniciación" con plantilla de transporte usa el mismo editor de precios por personas
   y horas, pero sus artículos no se mezclan con los del catálogo Transporte.
4. Activar / desactivar un catálogo completo. Un catálogo desactivado no ofrece nada al
   cliente, aunque sus artículos estén activos.
5. En una pregunta del configurador de tipo elección, en lugar de elegir solo "Alojamiento /
   Transporte / Motos", eliges **el catálogo concreto** de la lista. La pregunta muestra solo
   los artículos activos de ese catálogo.
6. Todo lo demás sigue igual: precios, `${variable}_price` en las fórmulas, dependencias,
   validación de activación, carrito, checkout, pago, vouchers e histórico de compras.

## Compatibilidad

- Los 3 catálogos actuales se mantienen tal cual, como catálogos normales de la lista.
- Las preguntas ya configuradas hoy (que apuntan a un tipo, no a un catálogo) seguirán
  funcionando: se resolverán contra el catálogo original de ese tipo.
- Ningún artículo, precio ni configuración existente se borra ni se mueve.

## Detalle técnico

- `catalogues` (ya existe: `template`, `internal_name`, `public_name`, `description`,
  `active`, `sort_order`) pasa a ser la entidad gestionable. Se añade panel Admin + funciones
  de servidor (crear, editar, activar, reordenar) con escritura solo Admin, lectura Staff,
  RLS y auditoría como el resto de módulos.
- Migración mínima de datos: asignar `catalogue_id` a los artículos existentes que no lo
  tengan (1 transporte suelto) y hacer `catalogue_id` obligatorio en `accommodations`,
  `transports`, `motorbikes` una vez saneado.
- `catalogue-bridge.ts`: el campo pasa a resolverse por `fields.catalogue_id` (columna ya
  existente) con fallback al `catalogue_type` actual. `CatalogueItem` gana `catalogue_id`;
  `CATALOGUE_TYPES` se conserva como conjunto de plantillas.
- `catalogue-bridge.server.ts`: los 3 resolvers reciben un `catalogue_id` opcional y filtran
  por él, además de exigir `catalogues.active`. Sin `catalogue_id` se comportan como hoy.
- `catalog.functions.ts` (`previewCatalogue`, validación de activación) y `cart.server.ts` /
  `pricing.functions.ts` resuelven por catálogo; `packages.catalogue_selections` guarda
  también el catálogo de origen para el histórico.
- Admin: nuevas rutas `/admin/catalogues` y `/admin/catalogues/$catalogueId`, reutilizando
  los paneles existentes de rooms/transport/motorbike filtrados por catálogo. Hoteles,
  Transporte y Motos siguen accesibles.
- `ConfiguratorTab.tsx`: el desplegable "Catalogue" lista catálogos activos por nombre.
- Tests: filtrado por catálogo, catálogo inactivo no ofrece artículos, fallback de preguntas
  antiguas, activación de producto con catálogo vacío, y regresión de precios/fórmulas.

## Fuera de alcance

Disponibilidad, reservas, nuevas plantillas distintas de las 3 actuales, plantillas
personalizables campo a campo, y cambios en pricing, carrito, checkout, pagos, vouchers o FX.
