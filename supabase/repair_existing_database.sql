-- BizFlow existing-database repair and consolidation script
-- Safe for a new Supabase project and idempotent for an existing BizFlow database.
-- Existing tables and business records are preserved. Policies/functions/triggers are refreshed.
-- Always create a Supabase backup before a major database change.

begin;

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


-- Compatibility cleanup for policy names used by earlier BizFlow builds.
drop policy if exists profiles_read_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists companies_insert_own on public.companies;
drop policy if exists companies_read_member_or_creator on public.companies;
drop policy if exists companies_update_members on public.companies;
drop policy if exists members_read_same_company on public.company_members;
drop policy if exists creator_adds_first_owner on public.company_members;
drop policy if exists tasks_company_access on public.tasks;
drop policy if exists customers_company_access on public.customers;
drop policy if exists transactions_company_access on public.transactions;
drop policy if exists invoices_company_access on public.invoices;
drop policy if exists invoice_items_access on public.invoice_items;
drop policy if exists payments_access on public.payments;
drop policy if exists products_company_access on public.products;
drop policy if exists stock_movements_company_access on public.stock_movements;
drop policy if exists departments_company_access on public.departments;
drop policy if exists employees_company_access on public.employees;
drop policy if exists leave_requests_company_access on public.leave_requests;

drop policy if exists "profiles read self" on public.profiles;
create policy "profiles read self" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "companies insert own" on public.companies;
create policy "companies insert own" on public.companies for insert to authenticated with check ((select auth.uid()) = created_by);
drop policy if exists "companies read member or creator" on public.companies;
create policy "companies read member or creator" on public.companies for select to authenticated using (public.is_company_member(id) or created_by = (select auth.uid()));
drop policy if exists "companies update members" on public.companies;
create policy "companies update members" on public.companies for update to authenticated using (public.is_company_member(id)) with check (public.is_company_member(id));

drop policy if exists "members read same company" on public.company_members;
create policy "members read same company" on public.company_members for select to authenticated using (public.is_company_member(company_id) or user_id = (select auth.uid()));
drop policy if exists "creator adds first owner" on public.company_members;
create policy "creator adds first owner" on public.company_members for insert to authenticated with check (
  user_id = (select auth.uid()) and role = 'owner' and exists(select 1 from public.companies c where c.id = company_id and c.created_by = (select auth.uid()))
);

drop policy if exists "tasks company access" on public.tasks;
create policy "tasks company access" on public.tasks for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id) and created_by = (select auth.uid()));
drop policy if exists "customers company access" on public.customers;
create policy "customers company access" on public.customers for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists "transactions company access" on public.transactions;
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
drop policy if exists "invoices company access" on public.invoices;
create policy "invoices company access" on public.invoices for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
drop policy if exists "invoice items access" on public.invoice_items;
create policy "invoice items access" on public.invoice_items for all to authenticated using(exists(select 1 from public.invoices i where i.id=invoice_id and public.is_company_member(i.company_id))) with check(exists(select 1 from public.invoices i where i.id=invoice_id and public.is_company_member(i.company_id)));
drop policy if exists "payments access" on public.payments;
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
drop policy if exists "products company access" on public.products;
create policy "products company access" on public.products for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
drop policy if exists "stock movements company access" on public.stock_movements;
create policy "stock movements company access" on public.stock_movements for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));

-- Employee & Leave Management module
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, description text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  unique(company_id,name)
);
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null, employee_number text not null,
  first_name text not null, last_name text not null, email text, phone text, job_title text not null,
  employment_type text not null default 'full_time' check(employment_type in ('full_time','part_time','contract','intern')),
  status text not null default 'active' check(status in ('active','on_leave','inactive')), hire_date date not null default current_date,
  salary numeric(12,2) not null default 0 check(salary>=0), created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,employee_number)
);
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null check(leave_type in ('vacation','sick','personal','parental','other')),
  start_date date not null, end_date date not null, reason text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), check(end_date>=start_date)
);
create index if not exists departments_company_idx on public.departments(company_id);
create index if not exists employees_company_idx on public.employees(company_id);
create index if not exists employees_department_idx on public.employees(department_id);
create index if not exists leave_requests_company_idx on public.leave_requests(company_id);
create index if not exists leave_requests_employee_idx on public.leave_requests(employee_id);
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.leave_requests enable row level security;
drop policy if exists "departments company access" on public.departments;
create policy "departments company access" on public.departments for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
drop policy if exists "employees company access" on public.employees;
create policy "employees company access" on public.employees for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
drop policy if exists "leave requests company access" on public.leave_requests;
create policy "leave requests company access" on public.leave_requests for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));


-- BizFlow generated record numbers upgrade.
-- Run once after 004_employees.sql.
-- Adds permanent, company-scoped customer and employee numbers.

alter table public.customers
  add column if not exists customer_number text;

-- One transaction-level lock per company and record type prevents duplicate
-- numbers when two people create records at the same time.
create or replace function public.next_company_record_number(
  target_company uuid,
  record_prefix text,
  source_table regclass,
  source_column text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_value bigint;
  sql_text text;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_company::text || ':' || record_prefix, 0));

  sql_text := format(
    'select coalesce(max(nullif(regexp_replace(%1$I, ''\D'', '''', ''g''), '''')::bigint), 0) + 1 from %2$s where company_id = $1',
    source_column,
    source_table
  );
  execute sql_text into next_value using target_company;

  return record_prefix || '-' || lpad(next_value::text, 6, '0');
end;
$$;

revoke all on function public.next_company_record_number(uuid, text, regclass, text) from public;

create or replace function public.assign_customer_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_number is null or btrim(new.customer_number) = '' then
    new.customer_number := public.next_company_record_number(
      new.company_id,
      'CUS',
      'public.customers'::regclass,
      'customer_number'
    );
  elsif tg_op = 'UPDATE' and old.customer_number is not null and new.customer_number is distinct from old.customer_number then
    raise exception 'Customer number cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_assign_number on public.customers;
create trigger customers_assign_number
before insert or update of customer_number on public.customers
for each row execute function public.assign_customer_number();

-- Backfill existing customers in creation order.
with numbered as (
  select id,
         'CUS-' || lpad(row_number() over (partition by company_id order by created_at, id)::text, 6, '0') as generated_number
  from public.customers
  where customer_number is null or btrim(customer_number) = ''
)
update public.customers c
set customer_number = n.generated_number
from numbered n
where c.id = n.id;

alter table public.customers
  alter column customer_number set not null;

create unique index if not exists customers_company_customer_number_key
  on public.customers(company_id, customer_number);

create or replace function public.assign_employee_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.employee_number is null or btrim(new.employee_number) = '' then
    new.employee_number := public.next_company_record_number(
      new.company_id,
      'EMP',
      'public.employees'::regclass,
      'employee_number'
    );
  elsif tg_op = 'UPDATE' and new.employee_number is distinct from old.employee_number then
    raise exception 'Employee number cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_assign_number on public.employees;
create trigger employees_assign_number
before insert or update of employee_number on public.employees
for each row execute function public.assign_employee_number();


-- BizFlow V3: activity, notifications, calendar, settings, audit, attachments
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  href text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  event_type text not null default 'meeting' check(event_type in ('meeting','reminder','task','invoice','leave','other')),
  start_at timestamptz not null,
  end_at timestamptz,
  description text,
  related_type text,
  related_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  currency text not null default 'USD',
  tax_rate numeric(6,2) not null default 0,
  timezone text not null default 'UTC',
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  updated_at timestamptz not null default now()
);
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  file_url text not null,
  file_size bigint,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  table_name text not null,
  record_id uuid,
  operation text not null,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists activities_company_created_idx on public.activities(company_id,created_at desc);
create index if not exists notifications_company_read_idx on public.notifications(company_id,is_read,created_at desc);
create index if not exists calendar_events_company_start_idx on public.calendar_events(company_id,start_at);
create index if not exists audit_logs_company_created_idx on public.audit_logs(company_id,created_at desc);

alter table public.activities enable row level security;
alter table public.notifications enable row level security;
alter table public.calendar_events enable row level security;
alter table public.company_settings enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "activities company access" on public.activities;
drop policy if exists "activities company access" on public.activities;
create policy "activities company access" on public.activities for select to authenticated using(public.is_company_member(company_id));
drop policy if exists "notifications company access" on public.notifications;
drop policy if exists "notifications company access" on public.notifications;
create policy "notifications company access" on public.notifications for all to authenticated using(public.is_company_member(company_id) and (user_id is null or user_id=(select auth.uid()))) with check(public.is_company_member(company_id) and (user_id is null or user_id=(select auth.uid())));
drop policy if exists "calendar company access" on public.calendar_events;
drop policy if exists "calendar company access" on public.calendar_events;
create policy "calendar company access" on public.calendar_events for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
drop policy if exists "settings company access" on public.company_settings;
drop policy if exists "settings company access" on public.company_settings;
create policy "settings company access" on public.company_settings for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
drop policy if exists "attachments company access" on public.attachments;
drop policy if exists "attachments company access" on public.attachments;
create policy "attachments company access" on public.attachments for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and uploaded_by=(select auth.uid()));
drop policy if exists "audit company access" on public.audit_logs;
drop policy if exists "audit company access" on public.audit_logs;
create policy "audit company access" on public.audit_logs for select to authenticated using(public.is_company_member(company_id));

create or replace function public.bizflow_audit_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  row_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  cid uuid;
  rid uuid;
  label text;
  actor uuid := auth.uid();
  invoice_ref uuid;
begin
  cid := nullif(coalesce(row_new->>'company_id', row_old->>'company_id'), '')::uuid;
  rid := nullif(coalesce(row_new->>'id', row_old->>'id'), '')::uuid;

  -- Payments belong to a company through their invoice.
  if cid is null and tg_table_name = 'payments' then
    invoice_ref := nullif(coalesce(row_new->>'invoice_id', row_old->>'invoice_id'), '')::uuid;
    select i.company_id into cid from public.invoices i where i.id = invoice_ref;
  end if;

  -- Never block the original business operation if a future audited table
  -- does not expose a company relationship.
  if cid is null then
    return coalesce(new, old);
  end if;

  label := initcap(replace(tg_table_name, '_', ' ')) || ' ' || lower(tg_op);

  insert into public.audit_logs(company_id, table_name, record_id, operation, old_data, new_data, actor_id)
  values(
    cid,
    tg_table_name,
    rid,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then row_old end,
    case when tg_op in ('INSERT','UPDATE') then row_new end,
    actor
  );

  insert into public.activities(company_id, entity_type, entity_id, action, title, details, actor_id)
  values(cid, tg_table_name, rid, lower(tg_op), label, jsonb_build_object('operation', tg_op), actor);

  return coalesce(new, old);
exception
  when others then
    -- Audit logging must not make normal BizFlow saves fail.
    raise warning 'BizFlow audit logging skipped: %', sqlerrm;
    return coalesce(new, old);
end;
$$;

do $$ declare t text; begin
  foreach t in array array['customers','employees','tasks','invoices','products','transactions','payments','leave_requests'] loop
    execute format('drop trigger if exists bizflow_v3_audit on public.%I',t);
    execute format('create trigger bizflow_v3_audit after insert or update or delete on public.%I for each row execute function public.bizflow_audit_activity()',t);
  end loop;
end $$;

insert into public.company_settings(company_id)
select id from public.companies on conflict(company_id) do nothing;


commit;
