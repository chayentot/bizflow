-- Run this entire file in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  industry text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner','admin','manager','employee')),
  created_at timestamptz not null default now(),
  unique(company_id,user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','review','completed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  assigned_to uuid references auth.users(id),
  due_date date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company_name text,
  status text not null default 'lead' check (status in ('lead','active','inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  description text,
  transaction_date date not null default current_date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists company_members_user_idx on public.company_members(user_id);
create index if not exists tasks_company_idx on public.tasks(company_id);
create index if not exists customers_company_idx on public.customers(company_id);
create index if not exists transactions_company_idx on public.transactions(company_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.company_members cm where cm.company_id = target_company and cm.user_id = auth.uid());
$$;
revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.tasks enable row level security;
alter table public.customers enable row level security;
alter table public.transactions enable row level security;

create policy "profiles read self" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles update self" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "companies insert own" on public.companies for insert to authenticated with check ((select auth.uid()) = created_by);
create policy "companies read member or creator" on public.companies for select to authenticated using (public.is_company_member(id) or created_by = (select auth.uid()));
create policy "companies update members" on public.companies for update to authenticated using (public.is_company_member(id)) with check (public.is_company_member(id));

create policy "members read same company" on public.company_members for select to authenticated using (public.is_company_member(company_id) or user_id = (select auth.uid()));
create policy "creator adds first owner" on public.company_members for insert to authenticated with check (
  user_id = (select auth.uid()) and role = 'owner' and exists(select 1 from public.companies c where c.id = company_id and c.created_by = (select auth.uid()))
);

create policy "tasks company access" on public.tasks for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id) and created_by = (select auth.uid()));
create policy "customers company access" on public.customers for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "transactions company access" on public.transactions for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id) and created_by = (select auth.uid()));
-- Run this in Supabase SQL Editor to add invoices to an existing BizFlow database.
create table if not exists public.invoices (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 customer_id uuid not null references public.customers(id), invoice_number text not null,
 status text not null default 'draft' check(status in ('draft','sent','paid','cancelled')),
 issue_date date not null default current_date, due_date date not null,
 subtotal numeric(12,2) not null default 0, tax numeric(12,2) not null default 0,
 discount numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
 notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(company_id,invoice_number)
);
create table if not exists public.invoice_items (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
 description text not null, quantity numeric(12,2) not null check(quantity>0), unit_price numeric(12,2) not null check(unit_price>=0),
 total numeric(12,2) not null check(total>=0), created_at timestamptz not null default now()
);
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
 amount numeric(12,2) not null check(amount>0), payment_date date not null default current_date,
 payment_method text not null, reference text, notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists invoices_company_idx on public.invoices(company_id);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
create index if not exists payments_invoice_idx on public.payments(invoice_id);
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
create policy "invoices company access" on public.invoices for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
create policy "invoice items access" on public.invoice_items for all to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and public.is_company_member(i.company_id))) with check(exists(select 1 from public.invoices i where i.id=invoice_id and public.is_company_member(i.company_id)));
create policy "payments access" on public.payments for all to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and public.is_company_member(i.company_id))) with check(created_by=(select auth.uid()) and exists(select 1 from public.invoices i where i.id=invoice_id and public.is_company_member(i.company_id)));

-- Inventory module
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, sku text not null, barcode text, description text,
  cost numeric(12,2) not null default 0 check(cost>=0), selling_price numeric(12,2) not null default 0 check(selling_price>=0),
  quantity numeric(12,2) not null default 0 check(quantity>=0), low_stock_threshold numeric(12,2) not null default 5 check(low_stock_threshold>=0),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(company_id,sku)
);
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check(movement_type in ('initial','restock','sale','adjustment')),
  quantity_change numeric(12,2) not null check(quantity_change<>0), note text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.invoice_items add column if not exists product_id uuid references public.products(id) on delete set null;
create index if not exists products_company_idx on public.products(company_id);
create index if not exists stock_movements_company_idx on public.stock_movements(company_id);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id);
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
create policy "products company access" on public.products for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
create policy "stock movements company access" on public.stock_movements for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
