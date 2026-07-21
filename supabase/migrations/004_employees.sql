-- BizFlow Employee & Leave Management upgrade.
-- Run this file once in Supabase SQL Editor after 003_inventory.sql.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  employee_number text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  job_title text not null,
  employment_type text not null default 'full_time' check (employment_type in ('full_time','part_time','contract','intern')),
  status text not null default 'active' check (status in ('active','on_leave','inactive')),
  hire_date date not null default current_date,
  salary numeric(12,2) not null default 0 check (salary >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, employee_number)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null check (leave_type in ('vacation','sick','personal','parental','other')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists departments_company_idx on public.departments(company_id);
create index if not exists employees_company_idx on public.employees(company_id);
create index if not exists employees_department_idx on public.employees(department_id);
create index if not exists leave_requests_company_idx on public.leave_requests(company_id);
create index if not exists leave_requests_employee_idx on public.leave_requests(employee_id);

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.leave_requests enable row level security;

create policy "departments company access" on public.departments
for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id) and created_by = (select auth.uid()));

create policy "employees company access" on public.employees
for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id) and created_by = (select auth.uid()));

create policy "leave requests company access" on public.leave_requests
for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id) and created_by = (select auth.uid()));
