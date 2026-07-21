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
