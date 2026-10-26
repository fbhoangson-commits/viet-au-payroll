-- Employee History module: additive migration only.
-- Does not alter employees, app_users, existing auth, or existing RLS policies.

create table if not exists public.employee_history_event_types (
  code text primary key,
  label text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.employee_history_event_types (code, label, display_order)
values
  ('ONBOARDING', 'Tiếp nhận nhân sự', 1),
  ('PERSONAL_INFO', 'Thay đổi thông tin cá nhân', 2),
  ('DEPARTMENT_CHANGE', 'Thay đổi bộ phận', 3),
  ('TRANSFER', 'Điều chuyển công tác', 4),
  ('POSITION_CHANGE', 'Thay đổi chức danh', 5),
  ('GROUP_CHANGE', 'Thay đổi nhóm nhân sự', 6),
  ('EMPLOYMENT_CLASSIFICATION', 'Thay đổi phân loại lao động', 7),
  ('STATUS_CHANGE', 'Thay đổi trạng thái làm việc', 8),
  ('CONTRACT_CHANGE', 'Thay đổi thông tin hợp đồng', 9),
  ('PAY_POLICY_CHANGE', 'Thay đổi thông tin lương/định mức', 10),
  ('OFFBOARDING', 'Nghỉ việc', 11),
  ('REHIRE', 'Tiếp nhận lại', 12),
  ('OTHER', 'Điều chỉnh thông tin khác', 13)
on conflict (code) do nothing;

create table if not exists public.employee_history_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text not null,
  event_type text not null references public.employee_history_event_types(code) on update cascade on delete restrict,
  recorded_at timestamptz not null default now(),
  effective_date date,
  description text not null,
  before_value text,
  after_value text,
  decision_number text,
  decision_date date,
  notes text,
  source text not null default 'manual',
  actor_auth_user_id uuid,
  actor_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_history_events_employee_id_idx on public.employee_history_events(employee_id);
create index if not exists employee_history_events_employee_code_idx on public.employee_history_events(employee_code);
create index if not exists employee_history_events_recorded_at_idx on public.employee_history_events(recorded_at desc);
create index if not exists employee_history_events_effective_date_idx on public.employee_history_events(effective_date);
create index if not exists employee_history_events_type_idx on public.employee_history_events(event_type);

alter table public.employee_history_event_types enable row level security;
alter table public.employee_history_events enable row level security;

drop policy if exists employee_history_event_types_select_authenticated on public.employee_history_event_types;
create policy employee_history_event_types_select_authenticated
  on public.employee_history_event_types for select to authenticated using (true);

drop policy if exists employee_history_events_select_authenticated on public.employee_history_events;
create policy employee_history_events_select_authenticated
  on public.employee_history_events for select to authenticated using (true);

drop policy if exists employee_history_events_insert_authenticated on public.employee_history_events;
create policy employee_history_events_insert_authenticated
  on public.employee_history_events for insert to authenticated
  with check (auth.uid() = actor_auth_user_id);

-- Deliberately no UPDATE or DELETE policy: history is append-only for authenticated clients.
