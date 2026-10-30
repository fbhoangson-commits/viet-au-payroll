-- VIỆT ÂU PAYROLL: personal dashboard tasks.
-- Idempotent migration; each authenticated user can access only their own rows.
create table if not exists public.payroll_user_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text null check (description is null or char_length(description) <= 2000),
  due_date date null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists payroll_user_tasks_user_created_idx
  on public.payroll_user_tasks (user_id, created_at desc);
create index if not exists payroll_user_tasks_user_status_due_idx
  on public.payroll_user_tasks (user_id, status, due_date);

alter table public.payroll_user_tasks enable row level security;

-- Remove only policies owned by this feature, then recreate the intended owner policy.
drop policy if exists payroll_user_tasks_select_own on public.payroll_user_tasks;
drop policy if exists payroll_user_tasks_insert_own on public.payroll_user_tasks;
drop policy if exists payroll_user_tasks_update_own on public.payroll_user_tasks;
drop policy if exists payroll_user_tasks_delete_own on public.payroll_user_tasks;

create policy payroll_user_tasks_select_own
  on public.payroll_user_tasks for select to authenticated
  using (user_id = (select auth.uid()));
create policy payroll_user_tasks_insert_own
  on public.payroll_user_tasks for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy payroll_user_tasks_update_own
  on public.payroll_user_tasks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy payroll_user_tasks_delete_own
  on public.payroll_user_tasks for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.payroll_user_tasks to authenticated;
