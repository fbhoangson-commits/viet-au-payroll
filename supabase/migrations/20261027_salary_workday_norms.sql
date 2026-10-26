-- WEBAPP LƯƠNG VIỆT ÂU — Định Mức Ngày Công
-- Additive migration: only creates the position-based workday norm table.
-- Review schema and run in a test environment before production.
create table if not exists public.salary_workday_norms (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.salary_policy_versions(id) on delete restrict,
  position_key text not null,
  position_name text not null,
  workday_count numeric(8,2) not null check (workday_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_version_id, position_key)
);
create index if not exists salary_workday_norms_policy_idx
  on public.salary_workday_norms(policy_version_id);
alter table public.salary_workday_norms enable row level security;
drop policy if exists salary_workday_norms_select_authenticated on public.salary_workday_norms;
create policy salary_workday_norms_select_authenticated on public.salary_workday_norms
  for select to authenticated using (true);
drop policy if exists salary_workday_norms_write_authenticated on public.salary_workday_norms;
create policy salary_workday_norms_write_authenticated on public.salary_workday_norms
  for all to authenticated using (true) with check (true);
