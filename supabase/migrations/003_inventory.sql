-- Run this once in Supabase SQL Editor to add inventory to an existing BizFlow database.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sku text not null,
  barcode text,
  description text,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  low_stock_threshold numeric(12,2) not null default 5 check (low_stock_threshold >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, sku)
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('initial','restock','sale','adjustment')),
  quantity_change numeric(12,2) not null check (quantity_change <> 0),
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.invoice_items add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists products_company_idx on public.products(company_id);
create index if not exists stock_movements_company_idx on public.stock_movements(company_id);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id);

alter table public.products enable row level security;
alter table public.stock_movements enable row level security;

create policy "products company access" on public.products for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id) and created_by = (select auth.uid()));

create policy "stock movements company access" on public.stock_movements for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id) and created_by = (select auth.uid()));
