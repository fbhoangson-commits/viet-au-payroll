-- WEBAPP LƯƠNG VIỆT ÂU — Quản Lý Kỳ Lương
-- Additive migration: tạo các bảng riêng cho quản lý kỳ; không sửa/xóa bảng nghiệp vụ hiện có.
begin;

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('FIXED', 'EVENT')),
  name text not null,
  month text,
  start_date date,
  end_date date,
  description text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'OPEN', 'CLOSED')),
  employee_count integer not null default 0 check (employee_count >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_periods_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint payroll_periods_fixed_month_check check ((type = 'FIXED' and month is not null) or type = 'EVENT')
);

create unique index if not exists payroll_periods_fixed_month_uidx
  on public.payroll_periods(month) where type = 'FIXED';
create index if not exists payroll_periods_type_created_idx
  on public.payroll_periods(type, created_at desc);

create table if not exists public.payroll_period_employees (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  employee_name text not null,
  department text,
  position text,
  created_at timestamptz not null default now(),
  unique (period_id, employee_id),
  unique (period_id, employee_code)
);
create index if not exists payroll_period_employees_period_idx
  on public.payroll_period_employees(period_id, employee_code);

create table if not exists public.payroll_period_custom_columns (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete restrict,
  key text not null,
  label text not null,
  data_type text not null default 'currency' check (data_type in ('currency','number','text','date')),
  is_required boolean not null default false,
  display_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, key)
);
create index if not exists payroll_period_custom_columns_order_idx
  on public.payroll_period_custom_columns(period_id, display_order);

create table if not exists public.payroll_period_custom_values (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  employee_name text not null,
  data_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, employee_id),
  unique (period_id, employee_code)
);
create index if not exists payroll_period_custom_values_period_idx
  on public.payroll_period_custom_values(period_id, employee_code);

alter table public.payroll_periods enable row level security;
alter table public.payroll_period_employees enable row level security;
alter table public.payroll_period_custom_columns enable row level security;
alter table public.payroll_period_custom_values enable row level security;

drop policy if exists payroll_periods_authenticated_access on public.payroll_periods;
create policy payroll_periods_authenticated_access on public.payroll_periods
  for all to authenticated using (true) with check (true);
drop policy if exists payroll_period_employees_authenticated_access on public.payroll_period_employees;
create policy payroll_period_employees_authenticated_access on public.payroll_period_employees
  for all to authenticated using (true) with check (true);
drop policy if exists payroll_period_custom_columns_authenticated_access on public.payroll_period_custom_columns;
create policy payroll_period_custom_columns_authenticated_access on public.payroll_period_custom_columns
  for all to authenticated using (true) with check (true);
drop policy if exists payroll_period_custom_values_authenticated_access on public.payroll_period_custom_values;
create policy payroll_period_custom_values_authenticated_access on public.payroll_period_custom_values
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.payroll_periods to authenticated;
grant select, insert, update, delete on public.payroll_period_employees to authenticated;
grant select, insert, update, delete on public.payroll_period_custom_columns to authenticated;
grant select, insert, update, delete on public.payroll_period_custom_values to authenticated;

commit;
