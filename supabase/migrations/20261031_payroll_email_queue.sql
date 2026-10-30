begin;
create table if not exists public.payroll_email_queue (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  employee_code text,
  employee_name text,
  recipient_email text not null,
  period_label text not null,
  subject text not null,
  html_body text not null,
  text_body text not null,
  storage_bucket text not null default 'payslip-email-pdfs',
  storage_path text not null,
  file_name text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','SENDING','SENT','FAILED','NEEDS_REVIEW')),
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (payroll_run_id, employee_id)
);
create index if not exists payroll_email_queue_batch_idx on public.payroll_email_queue(batch_id, created_at);
create index if not exists payroll_email_queue_status_idx on public.payroll_email_queue(status, created_at);
alter table public.payroll_email_queue enable row level security;
drop policy if exists payroll_email_queue_read_operator on public.payroll_email_queue;
create policy payroll_email_queue_read_operator on public.payroll_email_queue for select to authenticated using (public.payroll_can_operate());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payslip-email-pdfs', 'payslip-email-pdfs', false, 3145728, array['text/html','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=3145728, allowed_mime_types=array['text/html','application/pdf'];
commit;
