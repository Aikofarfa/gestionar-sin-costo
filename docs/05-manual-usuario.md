# 05 · Manual de usuario

## Entrar por primera vez

1. El responsable configura la URL de GitHub Pages en **Supabase → Authentication → URL Configuration** (ver README).
2. Abre https://aikofarfa.github.io/gestionar-sin-costo/ y selecciona **Crear una cuenta**.
3. Confirma el correo si se solicita. Las cuentas nuevas quedan **pendientes** y no pueden ver información del negocio.
4. La primera cuenta administradora debe activarse manualmente como `role = 'admin'` e `is_active = true` desde el SQL Editor. Sigue el procedimiento del README.
5. Cuando un administrador apruebe la cuenta, vuelve a iniciar sesión para entrar al panel.

## Productos e inventario

Abre **Productos** y elige **Nuevo producto**. Registra nombre, código, categoría, precio en COP, existencias y cantidad mínima para alertas. Usa **Editar** para actualizar datos o **Eliminar** para retirar una referencia que no esté en ventas. Busca por nombre, código o categoría. Los productos en nivel mínimo aparecen en el resumen y en informes.

## Clientes

En **Clientes**, registra nombre y, si lo deseas, teléfono, correo y dirección. Busca por nombre, correo o teléfono. **Historial** lista las ventas asociadas; editar conserva el historial. Las ventas anteriores quedan registradas si se elimina un cliente.

## Registrar una venta

1. En **Ventas** o **Resumen**, pulsa **Registrar venta**.
2. Elige opcionalmente un cliente, añade uno o más productos y define cantidades.
3. Comprueba el total y confirma.
4. El servidor de base de datos valida existencias, guarda venta y detalle, y descuenta el stock en una sola transacción. Si no alcanza el inventario, no registra la venta ni cambia existencias.

## Informes

**Informes** muestra ingresos y transacciones del mes, productos más vendidos y referencias por reponer. **Descargar CSV** genera un archivo con las ventas accesibles para el negocio.

## Gestión de usuarios

El Administrador abre **Usuarios** para aprobar o suspender accesos, y alternar los roles Administrador/Vendedor de cuentas activas. Los vendedores no pueden consultar ni modificar perfiles. Las cuentas pendientes no pueden leer productos, clientes, ventas ni informes; RLS lo impide también si se intenta llamar directamente a la API.

## Cerrar sesión y recuperar acceso

Usa **Cerrar sesión** en la barra lateral. En la pantalla de acceso, escribe tu correo y elige **Olvidé mi contraseña** para solicitar un enlace de restablecimiento.
