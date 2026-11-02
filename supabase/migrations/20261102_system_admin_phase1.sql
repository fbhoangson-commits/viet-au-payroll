-- Phase 1: system RBAC + append-only activity log. Additive only; does not alter payroll tables/policies.
create table if not exists public.system_roles (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  description text, is_system boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.system_permissions (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  module text not null, action text not null, created_at timestamptz not null default now()
);
create table if not exists public.system_role_permissions (
  role_id uuid not null references public.system_roles(id) on delete cascade,
  permission_id uuid not null references public.system_permissions(id) on delete cascade,
  primary key(role_id,permission_id)
);
create table if not exists public.system_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.system_roles(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key(user_id,role_id)
);
create table if not exists public.system_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.system_activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text, module text not null, action text not null,
  entity_type text, entity_id text, description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_system_activity_logs_created on public.system_activity_logs(created_at desc);
create index if not exists idx_system_activity_logs_actor on public.system_activity_logs(actor_id,created_at desc);

insert into public.system_roles(code,name,description) values
 ('SUPER_ADMIN','SUPER ADMIN','Toàn quyền quản trị hệ thống'),
 ('PAYROLL_ACCOUNTANT','KẾ TOÁN TIỀN LƯƠNG','Truy cập nghiệp vụ tiền lương theo quyền được cấp')
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.system_permissions(code,name,module,action)
select m||'.'||a, n||' – '||upper(a), m, a
from (values
 ('payroll','Tiền lương'),('employees','Nhân sự'),('periods','Kỳ lương'),('reports','Báo cáo'),('system','Quản lý hệ thống')
) as modules(m,n)
cross join (values ('view'),('create'),('update'),('delete'),('approve'),('export'),('config')) as actions(a)
on conflict(code) do nothing;
insert into public.system_role_permissions(role_id,permission_id)
select r.id,p.id from public.system_roles r cross join public.system_permissions p
where r.code='SUPER_ADMIN' on conflict do nothing;
-- Accountant gets operational payroll permissions only; system administration is excluded.
insert into public.system_role_permissions(role_id,permission_id)
select r.id,p.id from public.system_roles r join public.system_permissions p on p.module in ('payroll','employees','periods','reports')
where r.code='PAYROLL_ACCOUNTANT' and p.action in ('view','create','update','approve','export') on conflict do nothing;

create or replace function public.system_has_role(p_role text)
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from public.system_user_roles ur join public.system_roles r on r.id=ur.role_id
 where ur.user_id=auth.uid() and r.code=p_role)
$$;
create or replace function public.system_is_admin()
returns boolean language sql stable security definer set search_path=public,auth as $$
 select public.system_has_role('SUPER_ADMIN')
$$;
revoke all on function public.system_has_role(text) from public;
revoke all on function public.system_is_admin() from public;
grant execute on function public.system_has_role(text) to authenticated;
grant execute on function public.system_is_admin() to authenticated;

-- Seed only the explicitly approved first Super Admin if the Auth user already exists.
insert into public.system_user_roles(user_id,role_id)
select u.id,r.id from auth.users u cross join public.system_roles r
where lower(u.email)=lower('fbhoangson@gmail.com') and r.code='SUPER_ADMIN'
on conflict do nothing;
insert into public.system_user_profiles(user_id,display_name)
select id,'Quản trị hệ thống' from auth.users where lower(email)=lower('fbhoangson@gmail.com')
on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
-- Seed Finance role only if its Auth account already exists. If absent, invite it through the admin UI/Edge Function.
insert into public.system_user_roles(user_id,role_id)
select u.id,r.id from auth.users u cross join public.system_roles r
where lower(u.email)=lower('tckt@thptvietau.edu.vn') and r.code='PAYROLL_ACCOUNTANT'
on conflict do nothing;
insert into public.system_user_profiles(user_id,display_name)
select id,'PHÒNG TÀI CHÍNH' from auth.users where lower(email)=lower('tckt@thptvietau.edu.vn')
on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();

alter table public.system_roles enable row level security;
alter table public.system_permissions enable row level security;
alter table public.system_role_permissions enable row level security;
alter table public.system_user_roles enable row level security;
alter table public.system_user_profiles enable row level security;
alter table public.system_activity_logs enable row level security;
drop policy if exists system_roles_admin_read on public.system_roles;
create policy system_roles_admin_read on public.system_roles for select to authenticated using(public.system_is_admin());
drop policy if exists system_permissions_admin_read on public.system_permissions;
create policy system_permissions_admin_read on public.system_permissions for select to authenticated using(public.system_is_admin());
drop policy if exists system_role_permissions_admin_read on public.system_role_permissions;
create policy system_role_permissions_admin_read on public.system_role_permissions for select to authenticated using(public.system_is_admin());
drop policy if exists system_user_roles_admin_read on public.system_user_roles;
create policy system_user_roles_admin_read on public.system_user_roles for select to authenticated using(public.system_is_admin() or user_id=auth.uid());
drop policy if exists system_user_profiles_admin_read on public.system_user_profiles;
create policy system_user_profiles_admin_read on public.system_user_profiles for select to authenticated using(public.system_is_admin() or user_id=auth.uid());
drop policy if exists system_activity_admin_read on public.system_activity_logs;
create policy system_activity_admin_read on public.system_activity_logs for select to authenticated using(public.system_is_admin());
drop policy if exists system_activity_insert_self on public.system_activity_logs;
create policy system_activity_insert_self on public.system_activity_logs for insert to authenticated with check(actor_id=auth.uid());
revoke all on public.system_roles,public.system_permissions,public.system_role_permissions,public.system_user_roles,public.system_user_profiles,public.system_activity_logs from anon;
grant select on public.system_roles,public.system_permissions,public.system_role_permissions,public.system_user_roles,public.system_user_profiles,public.system_activity_logs to authenticated;
grant insert on public.system_activity_logs to authenticated;
