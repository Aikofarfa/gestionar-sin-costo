-- GestPyme · esquema inicial para Supabase/Postgres.
-- Las tablas expuestas usan RLS. register_sale realiza cada venta dentro
-- de una única transacción y nunca expone una clave de servicio al navegador.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'vendedor' check (role in ('admin', 'vendedor')),
  business_name text not null default 'Mi negocio',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  code text unique,
  price numeric(12,2) not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 5 check (min_stock >= 0),
  category text,
  description text,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text,
  email text,
  address text,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid not null references auth.users(id),
  total numeric(12,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

create index if not exists products_name_idx on public.products (name);
create index if not exists products_stock_idx on public.products (stock, min_stock);
create index if not exists clients_name_idx on public.clients (name);
create index if not exists sales_created_at_idx on public.sales (created_at desc);
create index if not exists sale_items_product_idx on public.sale_items (product_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

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

  -- Bloquea las existencias y valida antes de registrar cualquier cambio.
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
    insert into public.sale_items (sale_id, product_id, quantity, unit_price)
    values (v_sale_id, v_product_id, v_quantity, v_product.price);
    update public.products set stock = stock - v_quantity where id = v_product_id;
  end loop;
  return v_sale_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- Elimina privilegios heredados/default y concede únicamente lo requerido.
revoke all on public.profiles, public.products, public.clients, public.sales, public.sale_items from public, anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.products, public.clients to authenticated;
grant select on public.sales, public.sale_items to authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.register_sale(uuid, jsonb) from public, anon;
grant execute on function public.register_sale(uuid, jsonb) to authenticated;

-- Un perfil solo ve el propio; el administrador puede ver y gestionar al equipo.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- La información comercial se comparte entre los usuarios de una única Pyme.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products for select to authenticated using (true);
drop policy if exists products_insert_authenticated on public.products;
create policy products_insert_authenticated on public.products for insert to authenticated with check (created_by = auth.uid());
drop policy if exists products_update_authenticated on public.products;
create policy products_update_authenticated on public.products for update to authenticated using (true) with check (true);
drop policy if exists products_delete_authenticated on public.products;
create policy products_delete_authenticated on public.products for delete to authenticated using (public.is_admin() or created_by = auth.uid());

drop policy if exists clients_select_authenticated on public.clients;
create policy clients_select_authenticated on public.clients for select to authenticated using (true);
drop policy if exists clients_insert_authenticated on public.clients;
create policy clients_insert_authenticated on public.clients for insert to authenticated with check (created_by = auth.uid());
drop policy if exists clients_update_authenticated on public.clients;
create policy clients_update_authenticated on public.clients for update to authenticated using (true) with check (true);
drop policy if exists clients_delete_authenticated on public.clients;
create policy clients_delete_authenticated on public.clients for delete to authenticated using (public.is_admin() or created_by = auth.uid());

drop policy if exists sales_select_authenticated on public.sales;
create policy sales_select_authenticated on public.sales for select to authenticated using (true);
drop policy if exists sale_items_select_authenticated on public.sale_items;
create policy sale_items_select_authenticated on public.sale_items for select to authenticated using (true);

-- No hay INSERT/UPDATE/DELETE directo de ventas desde la API del navegador.
revoke insert, update, delete on public.sales, public.sale_items from authenticated;
