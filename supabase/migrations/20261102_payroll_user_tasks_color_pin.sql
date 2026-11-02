-- Add personal-note appearance and pinning without changing existing task data.
alter table public.payroll_user_tasks
  add column if not exists color text not null default 'blue'
    check (color in ('blue','yellow','green','pink','purple','gray')),
  add column if not exists is_pinned boolean not null default false;

create index if not exists payroll_user_tasks_user_pinned_created_idx
  on public.payroll_user_tasks (user_id, is_pinned desc, created_at desc);
