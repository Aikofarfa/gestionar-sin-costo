# 03 · Arquitectura

## Componentes

```text
Navegador
  ├── HTML/CSS/JavaScript estático publicado por GitHub Pages
  ├── Supabase Auth: registro, sesión y recuperación de contraseña
  └── Supabase Data API (clave publishable + JWT de sesión)
        └── PostgreSQL: perfiles, productos, clientes, ventas y líneas
             ├── RLS valida el acceso del usuario
             └── RPC register_sale valida y descuenta stock en una transacción

GitHub Actions publica los archivos del repositorio en GitHub Pages.
```

## Decisiones

- Sitio estático sin servidor propio: GitHub Pages no ejecuta Next.js en servidor. El frontend usa HTML, CSS y módulos JavaScript, y llama Supabase desde el navegador.
- La URL del proyecto y su clave **publishable** son configuración pública de cliente. No se usa una clave secreta de servidor.
- La seguridad reside en autenticación, grants mínimos, políticas RLS y funciones SQL; no en ocultar el código del navegador.
- `register_sale(p_client_id, p_items)` verifica usuario autenticado, cliente, productos y cantidades, bloquea las filas afectadas, calcula precios desde la base y descuenta el stock de forma atómica.
- El registro crea siempre rol `vendedor`. El administrador se promueve mediante una operación manual en SQL Editor.
- El modelo no separa datos entre empresas; todos los usuarios autenticados pertenecen al mismo espacio de negocio.

## Estructura relevante

```text
index.html
config.js
assets/css/app.css
assets/js/app.js
assets/js/supabase.js
supabase/migrations/20261006140000_initial_gestpyme.sql
.github/workflows/pages.yml
docs/
```

## Despliegue

El workflow se ejecuta en cada push a `main`. Para habilitar el primer despliegue, el repositorio debe tener GitHub Pages con origen **GitHub Actions**. La URL esperada es `https://aikofarfa.github.io/gestionar-sin-costo/`.
