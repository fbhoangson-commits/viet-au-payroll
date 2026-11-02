-- VIET AU PAYROLL: monthly Google Drive backup (Apps Script gateway)
-- Run once in Supabase SQL Editor. This migration adds backup metadata and a
-- service-role-only snapshot RPC; it does not alter payroll tables or formulas.

create table if not exists public.system_backup_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCESS','FAILED')),
  source text not null default 'MANUAL' check (source in ('MANUAL','SCHEDULED')),
  file_name text,
  drive_file_id text,
  size_bytes bigint,
  checksum_sha256 text,
  table_count integer,
  row_count bigint,
  error_message text,
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_system_backup_runs_created_at
  on public.system_backup_runs(created_at desc);

alter table public.system_backup_runs enable row level security;
drop policy if exists system_backup_runs_admin_read on public.system_backup_runs;
create policy system_backup_runs_admin_read on public.system_backup_runs
  for select to authenticated using (public.system_is_admin());
revoke all on public.system_backup_runs from anon, authenticated;
grant select on public.system_backup_runs to authenticated;
grant all on public.system_backup_runs to service_role;

create or replace function public.system_export_database_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  t record;
  rows_json jsonb;
  all_tables jsonb := '{}'::jsonb;
  total_rows bigint := 0;
  table_rows bigint;
  total_tables integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  for t in
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb), count(*) from public.%I x', t.table_name)
      into rows_json, table_rows;
    all_tables := all_tables || jsonb_build_object(t.table_name, rows_json);
    total_rows := total_rows + coalesce(table_rows, 0);
    total_tables := total_tables + 1;
  end loop;

  return jsonb_build_object(
    'product', 'VIET_AU_PAYROLL',
    'format_version', 1,
    'created_at', now(),
    'scope', 'public_schema_data_only',
    'excluded', jsonb_build_array('auth.users', 'auth.identities', 'storage.objects file bytes', 'database roles and settings'),
    'table_count', total_tables,
    'row_count', total_rows,
    'tables', all_tables
  );
end;
$$;
revoke all on function public.system_export_database_snapshot() from public, anon, authenticated;
grant execute on function public.system_export_database_snapshot() to service_role;
