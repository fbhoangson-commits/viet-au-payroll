-- WEBAPP LƯƠNG VIỆT ÂU — Bảo Hiểm và Người Phụ Thuộc
-- Additive migration: creates only tables owned by this module.
-- Run after reviewing the current Supabase schema and RLS policies in a non-production environment first.
create table if not exists public.employee_insurance_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  participates_insurance boolean,
  insurance_salary_base numeric(14,2),
  employee_social_rate numeric(7,4),
  employee_health_rate numeric(7,4),
  employee_unemployment_rate numeric(7,4),
  employer_social_rate numeric(7,4),
  employer_health_rate numeric(7,4),
  employer_unemployment_rate numeric(7,4),
  effective_from date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_tax_dependents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  full_name text not null,
  relationship text,
  date_of_birth date,
  tax_code text,
  identification_number text,
  effective_from date,
  effective_to date,
  status text not null default 'Đang giảm trừ',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employee_tax_dependents_employee_idx
  on public.employee_tax_dependents(employee_id);

create table if not exists public.employee_income_commitments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  has_commitment boolean not null default false,
  effective_from date,
  effective_to date,
  document_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_union_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete restrict,
  is_union_member boolean not null default false,
  contribution_base numeric(14,2),
  employee_contribution numeric(14,2),
  employer_contribution numeric(14,2),
  effective_from date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_tax_relief_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique default 'default',
  personal_relief_amount numeric(14,2) not null default 15500000,
  dependent_relief_amount numeric(14,2) not null default 6200000,
  updated_at timestamptz not null default now()
);
insert into public.payroll_tax_relief_config(config_key, personal_relief_amount, dependent_relief_amount)
values ('default', 15500000, 6200000)
on conflict (config_key) do nothing;

alter table public.employee_insurance_profiles enable row level security;
alter table public.employee_tax_dependents enable row level security;
alter table public.employee_income_commitments enable row level security;
alter table public.employee_union_profiles enable row level security;
alter table public.payroll_tax_relief_config enable row level security;

-- Match the application's current authenticated-user access baseline.
-- If production uses role-specific policies, merge these rules with that policy model instead.
do $$
declare t text;
begin
  foreach t in array array[
    'employee_insurance_profiles','employee_tax_dependents',
    'employee_income_commitments','employee_union_profiles','payroll_tax_relief_config'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_access', t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.employee_insurance_profiles to authenticated;
grant select, insert, update, delete on public.employee_tax_dependents to authenticated;
grant select, insert, update, delete on public.employee_income_commitments to authenticated;
grant select, insert, update, delete on public.employee_union_profiles to authenticated;
grant select, insert, update, delete on public.payroll_tax_relief_config to authenticated;
