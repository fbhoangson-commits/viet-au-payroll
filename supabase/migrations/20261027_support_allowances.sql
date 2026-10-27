-- Mức Hỗ Trợ: additive schema, isolated from existing payroll modules.
create table if not exists public.employee_support_allowances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  amounts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.payroll_support_allowance_columns (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique default 'default',
  columns jsonb not null default '[
    {"key":"lunch","label":"Ăn trưa","active":true,"sort_order":1},
    {"key":"phone","label":"Điện thoại","active":true,"sort_order":2},
    {"key":"uniform","label":"Đồng phục","active":true,"sort_order":3}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.payroll_support_allowance_columns(config_key) values ('default')
on conflict (config_key) do nothing;
alter table public.employee_support_allowances enable row level security;
alter table public.payroll_support_allowance_columns enable row level security;
drop policy if exists employee_support_allowances_authenticated_access on public.employee_support_allowances;
create policy employee_support_allowances_authenticated_access on public.employee_support_allowances
  for all to authenticated using (true) with check (true);
drop policy if exists payroll_support_allowance_columns_authenticated_access on public.payroll_support_allowance_columns;
create policy payroll_support_allowance_columns_authenticated_access on public.payroll_support_allowance_columns
  for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.employee_support_allowances to authenticated;
grant select, insert, update, delete on public.payroll_support_allowance_columns to authenticated;
