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
create policy "activities company access" on public.activities for select to authenticated using(public.is_company_member(company_id));
drop policy if exists "notifications company access" on public.notifications;
create policy "notifications company access" on public.notifications for all to authenticated using(public.is_company_member(company_id) and (user_id is null or user_id=(select auth.uid()))) with check(public.is_company_member(company_id) and (user_id is null or user_id=(select auth.uid())));
drop policy if exists "calendar company access" on public.calendar_events;
create policy "calendar company access" on public.calendar_events for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and created_by=(select auth.uid()));
drop policy if exists "settings company access" on public.company_settings;
create policy "settings company access" on public.company_settings for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
drop policy if exists "attachments company access" on public.attachments;
create policy "attachments company access" on public.attachments for all to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id) and uploaded_by=(select auth.uid()));
drop policy if exists "audit company access" on public.audit_logs;
create policy "audit company access" on public.audit_logs for select to authenticated using(public.is_company_member(company_id));

create or replace function public.bizflow_audit_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid; rid uuid; label text; actor uuid;
begin
  cid := coalesce((to_jsonb(new)->>'company_id')::uuid,(to_jsonb(old)->>'company_id')::uuid);
  rid := coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(old)->>'id')::uuid);
  actor := auth.uid();
  label := initcap(replace(tg_table_name,'_',' ')) || ' ' || lower(tg_op);
  insert into public.audit_logs(company_id,table_name,record_id,operation,old_data,new_data,actor_id)
  values(cid,tg_table_name,rid,tg_op,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,actor);
  insert into public.activities(company_id,entity_type,entity_id,action,title,details,actor_id)
  values(cid,tg_table_name,rid,lower(tg_op),label,jsonb_build_object('operation',tg_op),actor);
  return coalesce(new,old);
end $$;

do $$ declare t text; begin
  foreach t in array array['customers','employees','tasks','invoices','products','transactions','payments','leave_requests'] loop
    execute format('drop trigger if exists bizflow_v3_audit on public.%I',t);
    execute format('create trigger bizflow_v3_audit after insert or update or delete on public.%I for each row execute function public.bizflow_audit_activity()',t);
  end loop;
end $$;

insert into public.company_settings(company_id)
select id from public.companies on conflict(company_id) do nothing;
