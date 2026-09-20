# Corregir el guardado del quinto apartado de Inicio

## Causa confirmada

La página **Inicio** está activa y su única sección también. En los datos guardados solo existen cuatro apartados, todos activos y visibles. El quinto no está oculto ni desordenado: **no llegó a guardarse**, por eso la web pública no puede mostrarlo.

## Cambios

1. Reproducir la creación de un quinto apartado desde Admin → Website → Home y localizar en qué punto se pierde el guardado.
2. Corregir únicamente el formulario o la acción de guardado responsable, manteniendo sin cambios los cuatro apartados actuales.
3. Hacer que Admin confirme el guardado solo cuando el nuevo apartado realmente exista; si falla, mostrará un aviso claro y conservará la información escrita para poder reintentarlo.
4. Comprobar que un quinto apartado activo aparece en Inicio, en el orden elegido, y que se puede pulsar si tiene un destino configurado.

## No se toca

Idiomas, navegación superior, diseño, productos, precios, configurador, carrito, pagos y vouchers.

## Verificación

- Crear y guardar un quinto apartado de prueba desde Admin.
- Confirmar que aparece inmediatamente en la lista de Admin y en Inicio.
- Recargar ambas páginas y confirmar que continúa visible.
- Verificar que los cuatro apartados existentes permanecen intactos.
