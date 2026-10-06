-- Ajustes de permisos y rendimiento tras la revisión del linter Supabase.

revoke all on function public.handle_new_user() from public, anon, authenticated;

create index if not exists products_created_by_idx on public.products (created_by);
create index if not exists clients_created_by_idx on public.clients (created_by);
create index if not exists sales_client_id_idx on public.sales (client_id);
create index if not exists sales_user_id_idx on public.sales (user_id);
create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);

-- Evalúa auth.uid()/is_admin() una sola vez por sentencia, no por fila.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists products_insert_authenticated on public.products;
create policy products_insert_authenticated on public.products for insert to authenticated
  with check (created_by = (select auth.uid()));
drop policy if exists products_delete_authenticated on public.products;
create policy products_delete_authenticated on public.products for delete to authenticated
  using ((select public.is_admin()) or created_by = (select auth.uid()));

drop policy if exists clients_insert_authenticated on public.clients;
create policy clients_insert_authenticated on public.clients for insert to authenticated
  with check (created_by = (select auth.uid()));
drop policy if exists clients_delete_authenticated on public.clients;
create policy clients_delete_authenticated on public.clients for delete to authenticated
  using ((select public.is_admin()) or created_by = (select auth.uid()));

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
  if auth.uid() is null then raise exception 'Debes iniciar sesión para registrar ventas'; end if;
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
