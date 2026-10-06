# 04 · Modelo de datos

La migración versionada crea cinco tablas en el esquema `public`.

| Tabla | Propósito | Campos clave |
|---|---|---|
| `profiles` | Perfil de usuario autenticado | `id` (FK a `auth.users`), `email`, `full_name`, `role`, `business_name` |
| `products` | Catálogo e inventario | `id`, `name`, `code`, `price`, `stock`, `min_stock`, `category`, `description`, `created_by` |
| `clients` | Directorio de clientes | `id`, `name`, `phone`, `email`, `address`, `created_by` |
| `sales` | Encabezado de cada venta | `id`, `client_id` opcional, `user_id`, `total`, `created_at` |
| `sale_items` | Productos y cantidades por venta | `id`, `sale_id`, `product_id`, `quantity`, `unit_price` |

## Relaciones

- `profiles.id` referencia `auth.users.id`; un trigger crea el perfil al registrarse.
- `products.created_by` y `clients.created_by` registran el usuario creador.
- `sales.client_id` puede quedar vacío; al eliminar un cliente, la venta histórica se conserva.
- `sales.user_id` referencia al usuario que registró la venta.
- `sale_items.sale_id` referencia la venta y `sale_items.product_id` referencia el producto. Los registros históricos evitan borrar el producto referenciado.

## Seguridad y consistencia

RLS se habilita en las cinco tablas. El cliente autenticado solo ve su propio perfil; el rol Administrador puede consultar y cambiar perfiles. Los usuarios autenticados del negocio comparten productos, clientes e historial de ventas. El navegador solo puede leer ventas; crear una venta requiere ejecutar la función `register_sale`. Restricciones de Postgres impiden cantidades negativas, precios negativos y existencias negativas.

Los importes se guardan como `numeric(12,2)` y el frontend los muestra en COP. Los IDs son UUID.
