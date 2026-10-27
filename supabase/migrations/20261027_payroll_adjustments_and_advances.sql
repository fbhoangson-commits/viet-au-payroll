-- WEBAPP LƯƠNG VIỆT ÂU — Khoản Cộng Trừ và Tạm Ứng
-- Additive migration. Does not alter existing payroll tables or payroll formulas.
begin;

create table if not exists public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  employee_name text not null,
  kind text not null check (kind in ('ADD','DEDUCT')),
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  effective_date date not null default current_date,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payroll_adjustments_period_employee_idx
  on public.payroll_adjustments(period_id, employee_code);
create index if not exists payroll_adjustments_status_idx
  on public.payroll_adjustments(period_id, status, kind);

create table if not exists public.payroll_advances (
  id uuid primary key default gen_random_uuid(),
  code text generated always as ('TU-' || upper(substr(replace(id::text,'-',''),1,10))) stored unique,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  employee_name text not null,
  advance_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  description text,
  start_period_id uuid references public.payroll_periods(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payroll_advances_employee_date_idx
  on public.payroll_advances(employee_id, advance_date desc);

create table if not exists public.payroll_advance_recoveries (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.payroll_advances(id) on delete restrict,
  period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  employee_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'PLANNED' check (status in ('PLANNED','POSTED','CANCELLED')),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payroll_advance_recoveries_active_period_uidx
  on public.payroll_advance_recoveries(advance_id, period_id) where status <> 'CANCELLED';
create index if not exists payroll_advance_recoveries_advance_idx
  on public.payroll_advance_recoveries(advance_id, created_at);
create index if not exists payroll_advance_recoveries_period_idx
  on public.payroll_advance_recoveries(period_id, employee_code, status);

alter table public.payroll_adjustments enable row level security;
alter table public.payroll_advances enable row level security;
alter table public.payroll_advance_recoveries enable row level security;

drop policy if exists payroll_adjustments_authenticated_access on public.payroll_adjustments;
create policy payroll_adjustments_authenticated_access on public.payroll_adjustments
  for all to authenticated using (true) with check (true);
drop policy if exists payroll_advances_authenticated_access on public.payroll_advances;
create policy payroll_advances_authenticated_access on public.payroll_advances
  for all to authenticated using (true) with check (true);
drop policy if exists payroll_advance_recoveries_authenticated_access on public.payroll_advance_recoveries;
create policy payroll_advance_recoveries_authenticated_access on public.payroll_advance_recoveries
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.payroll_adjustments to authenticated;
grant select, insert, update, delete on public.payroll_advances to authenticated;
grant select, insert, update, delete on public.payroll_advance_recoveries to authenticated;

commit;
