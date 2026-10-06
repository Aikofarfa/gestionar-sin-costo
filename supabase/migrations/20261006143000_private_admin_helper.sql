-- Las políticas necesitan comprobar el rol admin. La función vive en un
-- esquema no expuesto a PostgREST para que no se invoque como RPC público.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists products_delete_authenticated on public.products;
create policy products_delete_authenticated on public.products for delete to authenticated
  using ((select private.is_admin()) or created_by = (select auth.uid()));
drop policy if exists clients_delete_authenticated on public.clients;
create policy clients_delete_authenticated on public.clients for delete to authenticated
  using ((select private.is_admin()) or created_by = (select auth.uid()));

-- Después de migrar todas las políticas, elimina la antigua función expuesta.
revoke all on function public.is_admin() from public, anon, authenticated;
drop function if exists public.is_admin();
