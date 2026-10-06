# GestPyme

**Sistema web de gestión de inventario, ventas y clientes para pequeñas empresas colombianas.** Interfaz en español, responsive y con el sistema visual inspirado en Apple documentado en [`DESIGN.md`](./DESIGN.md). Las instrucciones de frontend están en [`AGENTS.md`](./AGENTS.md).

## Aplicación publicada

- **GitHub Pages:** https://aikofarfa.github.io/gestionar-sin-costo/
- **Código fuente:** https://github.com/Aikofarfa/gestionar-sin-costo
- **Base de datos y autenticación:** proyecto Supabase `GestPyme` (región US East).

GitHub Pages aloja el frontend estático; Supabase proporciona inicio de sesión y datos compartidos. La página solo usa la clave **publishable** de Supabase, que es pública por diseño. El acceso está protegido con Row Level Security (RLS); nunca se necesita ni debe publicarse una clave `secret` o `service_role`.

## Funcionalidades

- Panel con ventas del día y del mes, productos, stock bajo, ventas recientes y referencias más vendidas.
- Productos: alta, búsqueda, edición, niveles mínimos y alertas de existencias.
- Clientes: alta, búsqueda, edición e historial de compras.
- Ventas: carrito sencillo, cliente opcional, control de existencias y descuento atómico del stock.
- Informes de ventas, alertas de inventario y descarga CSV.
- Registro e inicio de sesión por correo, recuperación de contraseña y perfiles de Administrador/Vendedor.
- Responsive para escritorio, tableta y teléfono.

## Primer acceso y administrador

1. Abre la [aplicación](https://aikofarfa.github.io/gestionar-sin-costo/) y crea una cuenta con el correo de la persona administradora.
2. Si Supabase pide confirmación, confirma el correo y vuelve al sitio para iniciar sesión.
3. Para otorgar el rol de administrador inicial, entra al [SQL Editor del proyecto Supabase](https://supabase.com/dashboard/project/lrufurcgqnkwtphlrqni/sql/new) y ejecuta, reemplazando el correo:

   ```sql
   update public.profiles
   set role = 'admin'
   where lower(email) = lower('tu-correo@ejemplo.com');
   ```

4. Cierra sesión y vuelve a entrar. La cuenta Administrador tendrá acceso a la sección **Usuarios**, donde podrá cambiar el rol de los demás perfiles.

El registro público crea perfiles con rol **Vendedor**; nunca concede privilegios de administrador automáticamente. Esta protección evita que una persona desconocida se registre primero y obtenga control administrativo. En un despliegue de feria, crea y confirma primero la cuenta administradora. Si se desea cerrar el registro público después, se puede ajustar la opción de registro en Authentication del panel de Supabase.

## Supabase y seguridad

El esquema aplicado está versionado en [`supabase/migrations/20261006140000_initial_gestpyme.sql`](./supabase/migrations/20261006140000_initial_gestpyme.sql). Incluye perfiles, productos, clientes, ventas y líneas de venta; activa RLS en todas las tablas. La función `register_sale` valida y descuenta existencias dentro de una transacción de Postgres. No se permiten altas/modificaciones directas de ventas desde el navegador.

En Supabase → **Authentication → URL Configuration**, configura:

- **Site URL:** `https://aikofarfa.github.io/gestionar-sin-costo/`
- **Redirect URLs:** `https://aikofarfa.github.io/gestionar-sin-costo/` y `https://aikofarfa.github.io/gestionar-sin-costo/**`

La aplicación usa `config.js` para leer el URL y la clave publishable del proyecto. Son valores públicos para aplicaciones en navegador; no agregues contraseñas, `secret` keys ni `service_role` keys a ese archivo. No hay separación multiempresa: los usuarios autenticados de este único negocio comparten productos, clientes y ventas, como indica el alcance del proyecto.

## Publicación en GitHub Pages

El workflow [`.github/workflows/pages.yml`](./.github/workflows/pages.yml) publica la raíz del repositorio automáticamente en cada `push` a `main`, y también puede iniciarse manualmente desde **Actions**. En el repositorio, **Settings → Pages → Build and deployment → Source** debe estar configurado como **GitHub Actions**.

Para desarrollo local, sirve la carpeta raíz con cualquier servidor HTTP estático; evita abrir `index.html` con `file://`, ya que el navegador debe poder cargar los módulos ES y el SDK de Supabase.

## Documentación

- [Problema y solución](./docs/01-problema.md)
- [Requisitos](./docs/02-requisitos.md)
- [Arquitectura](./docs/03-arquitectura.md)
- [Modelo de datos](./docs/04-modelo-datos.md)
- [Manual de usuario](./docs/05-manual-usuario.md)
- [Sistema de diseño](./DESIGN.md)
