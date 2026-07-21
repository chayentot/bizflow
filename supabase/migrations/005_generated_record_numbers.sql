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
