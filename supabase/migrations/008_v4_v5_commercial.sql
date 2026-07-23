-- BizFlow V4 + V5 Commercial & Automation Edition
-- Safe, idempotent upgrade for an existing V3 database.

create sequence if not exists public.supplier_number_seq start 1;
create sequence if not exists public.purchase_order_number_seq start 1;
create sequence if not exists public.supplier_bill_number_seq start 1;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_number text not null,
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  tax_number text,
  payment_terms text default 'Net 30',
  status text not null default 'active' check(status in ('active','inactive')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,supplier_number)
);
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  po_number text not null,
  status text not null default 'draft' check(status in ('draft','ordered','partially_received','received','cancelled')),
  order_date date not null default current_date,
  expected_date date,
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,po_number)
);
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text not null,
  quantity numeric(14,2) not null check(quantity > 0),
  received_quantity numeric(14,2) not null default 0 check(received_quantity >= 0),
  unit_cost numeric(14,2) not null check(unit_cost >= 0),
  line_total numeric(14,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);
create table if not exists public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  purchase_order_id uuid references public.purchase_orders(id),
  bill_number text not null,
  bill_date date not null default current_date,
  due_date date,
  amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  status text not null default 'unpaid' check(status in ('unpaid','partial','paid','void')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,bill_number)
);
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_bill_id uuid not null references public.supplier_bills(id) on delete cascade,
  amount numeric(14,2) not null check(amount > 0),
  payment_date date not null default current_date,
  method text not null default 'bank_transfer',
  reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  trigger_type text not null check(trigger_type in ('low_stock','invoice_overdue','task_due','po_received','leave_approved')),
  action_type text not null default 'notification' check(action_type in ('notification','create_task')),
  is_enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  status text not null default 'success',
  message text,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_company_idx on public.suppliers(company_id,name);
create index if not exists purchase_orders_company_idx on public.purchase_orders(company_id,created_at desc);
create index if not exists purchase_order_items_po_idx on public.purchase_order_items(purchase_order_id);
create index if not exists supplier_bills_company_idx on public.supplier_bills(company_id,due_date,status);
create index if not exists automation_rules_company_idx on public.automation_rules(company_id,is_enabled);

create or replace function public.assign_supplier_number() returns trigger language plpgsql as $$
begin if new.supplier_number is null or new.supplier_number='' then new.supplier_number := 'SUP-'||lpad(nextval('public.supplier_number_seq')::text,6,'0'); end if; return new; end $$;
create or replace function public.assign_po_number() returns trigger language plpgsql as $$
begin if new.po_number is null or new.po_number='' then new.po_number := 'PO-'||lpad(nextval('public.purchase_order_number_seq')::text,6,'0'); end if; return new; end $$;
create or replace function public.assign_supplier_bill_number() returns trigger language plpgsql as $$
begin if new.bill_number is null or new.bill_number='' then new.bill_number := 'BILL-'||lpad(nextval('public.supplier_bill_number_seq')::text,6,'0'); end if; return new; end $$;
drop trigger if exists suppliers_assign_number on public.suppliers;
create trigger suppliers_assign_number before insert on public.suppliers for each row execute function public.assign_supplier_number();
drop trigger if exists purchase_orders_assign_number on public.purchase_orders;
create trigger purchase_orders_assign_number before insert on public.purchase_orders for each row execute function public.assign_po_number();
drop trigger if exists supplier_bills_assign_number on public.supplier_bills;
create trigger supplier_bills_assign_number before insert on public.supplier_bills for each row execute function public.assign_supplier_bill_number();

create or replace function public.receive_purchase_order(p_purchase_order_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare po public.purchase_orders%rowtype; item record; delta numeric;
begin
  select * into po from public.purchase_orders where id=p_purchase_order_id for update;
  if po.id is null then raise exception 'Purchase order not found'; end if;
  if not public.is_company_member(po.company_id) then raise exception 'Access denied'; end if;
  if po.status in ('received','cancelled') then raise exception 'Purchase order cannot be received'; end if;
  for item in select * from public.purchase_order_items where purchase_order_id=po.id for update loop
    delta := item.quantity-item.received_quantity;
    if delta>0 then
      update public.products set quantity=quantity+delta, cost=item.unit_cost, updated_at=now() where id=item.product_id and company_id=po.company_id;
      update public.purchase_order_items set received_quantity=quantity where id=item.id;
      insert into public.stock_movements(company_id,product_id,movement_type,quantity_change,note,created_by)
      values(po.company_id,item.product_id,'purchase',delta,po.po_number,p_actor);
    end if;
  end loop;
  update public.purchase_orders set status='received',updated_at=now() where id=po.id;
  insert into public.supplier_bills(company_id,supplier_id,purchase_order_id,bill_number,bill_date,due_date,amount,created_by)
  values(po.company_id,po.supplier_id,po.id,'',current_date,current_date+30,po.total,p_actor)
  on conflict do nothing;
  insert into public.notifications(company_id,type,title,message,href)
  values(po.company_id,'success','Purchase order received',po.po_number||' was received and inventory was updated.','/purchasing/'||po.id);
end $$;

create or replace function public.refresh_supplier_bill_status() returns trigger language plpgsql security definer set search_path=public as $$
declare total_paid numeric; total_amount numeric; bid uuid;
begin
 bid:=coalesce(new.supplier_bill_id,old.supplier_bill_id);
 select coalesce(sum(amount),0) into total_paid from public.supplier_payments where supplier_bill_id=bid;
 select amount into total_amount from public.supplier_bills where id=bid;
 update public.supplier_bills set paid_amount=total_paid,status=case when total_paid<=0 then 'unpaid' when total_paid>=total_amount then 'paid' else 'partial' end,updated_at=now() where id=bid;
 return coalesce(new,old);
end $$;
drop trigger if exists supplier_payment_refresh_bill on public.supplier_payments;
create trigger supplier_payment_refresh_bill after insert or update or delete on public.supplier_payments for each row execute function public.refresh_supplier_bill_status();

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.supplier_bills enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists "suppliers company access" on public.suppliers;
create policy "suppliers company access" on public.suppliers for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
drop policy if exists "purchase orders company access" on public.purchase_orders;
create policy "purchase orders company access" on public.purchase_orders for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
drop policy if exists "purchase order items company access" on public.purchase_order_items;
create policy "purchase order items company access" on public.purchase_order_items for all to authenticated using(exists(select 1 from public.purchase_orders p where p.id=purchase_order_id and public.is_company_member(p.company_id))) with check(exists(select 1 from public.purchase_orders p where p.id=purchase_order_id and public.is_company_member(p.company_id)));
drop policy if exists "supplier bills company access" on public.supplier_bills;
create policy "supplier bills company access" on public.supplier_bills for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
drop policy if exists "supplier payments company access" on public.supplier_payments;
create policy "supplier payments company access" on public.supplier_payments for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
drop policy if exists "automation rules company access" on public.automation_rules;
create policy "automation rules company access" on public.automation_rules for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
drop policy if exists "automation runs company access" on public.automation_runs;
create policy "automation runs company access" on public.automation_runs for select to authenticated using(public.is_company_member(company_id));

do $$ declare t text; begin
 foreach t in array array['suppliers','purchase_orders','supplier_bills','supplier_payments','automation_rules'] loop
  execute format('drop trigger if exists bizflow_v3_audit on public.%I',t);
  execute format('create trigger bizflow_v3_audit after insert or update or delete on public.%I for each row execute function public.bizflow_audit_activity()',t);
 end loop;
end $$;
