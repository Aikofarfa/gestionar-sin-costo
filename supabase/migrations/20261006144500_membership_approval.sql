-- Por defecto las cuentas nuevas no pertenecen todavía al negocio.
alter table public.profiles add column if not exists is_active boolean not null default false;

create or replace function private.is_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and is_active = true); $$;
revoke all on function private.is_member() from public, anon;
grant execute on function private.is_member() to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and is_active = true and role = 'admin'); $$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Mantener el perfil propio visible para mostrar el estado pendiente.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Todas las tablas operativas quedan limitadas a miembros aprobados.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products for select to authenticated
  using ((select private.is_member()));
drop policy if exists products_insert_authenticated on public.products;
create policy products_insert_authenticated on public.products for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
drop policy if exists products_update_authenticated on public.products;
create policy products_update_authenticated on public.products for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
drop policy if exists products_delete_authenticated on public.products;
create policy products_delete_authenticated on public.products for delete to authenticated
  using ((select private.is_member()) and ((select private.is_admin()) or created_by = (select auth.uid())));

drop policy if exists clients_select_authenticated on public.clients;
create policy clients_select_authenticated on public.clients for select to authenticated
  using ((select private.is_member()));
drop policy if exists clients_insert_authenticated on public.clients;
create policy clients_insert_authenticated on public.clients for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
drop policy if exists clients_update_authenticated on public.clients;
create policy clients_update_authenticated on public.clients for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
drop policy if exists clients_delete_authenticated on public.clients;
create policy clients_delete_authenticated on public.clients for delete to authenticated
  using ((select private.is_member()) and ((select private.is_admin()) or created_by = (select auth.uid())));

drop policy if exists sales_select_authenticated on public.sales;
create policy sales_select_authenticated on public.sales for select to authenticated
  using ((select private.is_member()));
drop policy if exists sale_items_select_authenticated on public.sale_items;
create policy sale_items_select_authenticated on public.sale_items for select to authenticated
  using ((select private.is_member()));

create or replace function public.register_sale(p_client_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_total numeric(12,2) := 0;
  v_quantity integer;
  v_product_id uuid;
begin
  if auth.uid() is null or not private.is_member() then raise exception 'Debes tener una cuenta aprobada para registrar ventas'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La venta debe tener al menos un producto'; end if;
  if p_client_id is not null and not exists (select 1 from public.clients where id = p_client_id) then raise exception 'El cliente seleccionado no existe'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
    select * into v_product from public.products where id = v_product_id for update;
    if not found then raise exception 'Uno de los productos no existe'; end if;
    if v_product.stock < v_quantity then raise exception 'Stock insuficiente para: %', v_product.name; end if;
    v_total := v_total + (v_product.price * v_quantity);
  end loop;
  insert into public.sales (client_id, user_id, total) values (p_client_id, auth.uid(), v_total) returning id into v_sale_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    select * into v_product from public.products where id = v_product_id for update;
    insert into public.sale_items (sale_id, product_id, quantity, unit_price) values (v_sale_id, v_product_id, v_quantity, v_product.price);
    update public.products set stock = stock - v_quantity where id = v_product_id;
  end loop;
  return v_sale_id;
end;
$$;
