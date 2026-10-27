-- WEBAPP LƯƠNG VIỆT ÂU: dữ liệu BHXH/thuế điều chỉnh theo từng kỳ lương.
-- Additive migration. Không sửa/xóa hồ sơ nhân sự hoặc các bảng nghiệp vụ hiện có.
begin;
create table if not exists public.payroll_period_insurance_tax_data (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.payroll_periods(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  employee_name text not null,
  employee_type text not null default 'Cơ Hữu',
  participates_insurance boolean,
  insurance_salary_base numeric(14,2),
  employee_social_rate numeric(7,4) not null default 8,
  employee_health_rate numeric(7,4) not null default 1.5,
  employee_unemployment_rate numeric(7,4) not null default 1,
  dependent_count integer not null default 0 check (dependent_count >= 0),
  personal_relief_amount numeric(14,2) not null default 15500000,
  dependent_relief_amount numeric(14,2) not null default 6200000,
  support_amount numeric(14,2) not null default 0,
  has_commitment boolean not null default false,
  commitment_validated boolean not null default false,
  commitment_reference text,
  taxable_income_override numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_id, employee_id)
);
create index if not exists payroll_period_ins_tax_period_idx on public.payroll_period_insurance_tax_data(period_id, employee_code);
alter table public.payroll_period_insurance_tax_data enable row level security;
drop policy if exists payroll_period_ins_tax_authenticated_access on public.payroll_period_insurance_tax_data;
create policy payroll_period_ins_tax_authenticated_access on public.payroll_period_insurance_tax_data for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.payroll_period_insurance_tax_data to authenticated;
commit;
