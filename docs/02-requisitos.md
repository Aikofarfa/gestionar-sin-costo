# 02 · Requisitos

| ID | Requisito | Cobertura |
|---|---|---|
| RF01 | Registro, inicio y recuperación de contraseña | Supabase Auth por correo |
| RF02 | Roles Administrador y Vendedor | Perfil protegido por RLS; cada cuenta nueva comienza como Vendedor |
| RF03 | CRUD de productos | Crear, leer, editar y eliminar con búsqueda |
| RF04 | Alertas de stock bajo | Nivel mínimo configurable; visible en panel e informes |
| RF05 | Registrar venta con productos, cantidades y cliente opcional | Formulario de venta con carrito |
| RF06 | Descontar existencias al vender | RPC transaccional `register_sale`; validación de stock en Postgres |
| RF07 | CRUD de clientes | Crear, leer, editar, eliminar y buscar |
| RF08 | Historial de compras del cliente | Consulta de ventas asociadas a cada cliente |
| RF09 | Dashboard día/mes, stock bajo y más vendidos | Panel e informes conectados a Supabase |
| RF10 | Búsqueda y filtros | Búsqueda por producto y cliente |

## Requisitos no funcionales

- Frontend estático compatible con GitHub Pages y plan gratuito de Supabase.
- Diseño responsive, accesible por teclado y en español.
- Código fuente y migración SQL versionados en el repositorio público.
- RLS activado para todos los datos de la aplicación.
- Los importes se muestran en pesos colombianos (COP).

## Consideraciones

El modelo corresponde a un único negocio. Los usuarios autenticados comparten el catálogo, los clientes y las ventas; no existe tenant ni separación por empresa. Las cuentas de vendedores no pueden cambiar roles. El primer administrador se asigna de forma manual en el SQL Editor de Supabase para impedir la elevación automática de una cuenta pública.
