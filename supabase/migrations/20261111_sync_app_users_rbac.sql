-- Đồng bộ tài khoản hệ thống với bảng app_users hiện hữu.
-- Không tạo tài khoản Auth mới; chỉ bổ sung hồ sơ app_users cho các Auth user đã tồn tại.
insert into public.app_users (id, email, display_name, role, active, created_at, updated_at)
select
  u.id,
  lower(u.email),
  coalesce(nullif(p.display_name,''), nullif(u.raw_user_meta_data->>'display_name',''), nullif(u.raw_user_meta_data->>'full_name',''), u.email),
  coalesce(r.code, 'PAYROLL_ACCOUNTANT'),
  coalesce(p.is_active, true),
  u.created_at,
  now()
from auth.users u
left join public.system_user_profiles p on p.user_id = u.id
left join lateral (
  select sr.code
  from public.system_user_roles sur
  join public.system_roles sr on sr.id = sur.role_id
  where sur.user_id = u.id
  order by case when sr.code='SUPER_ADMIN' then 0 else 1 end
  limit 1
) r on true
where u.email is not null
  and not exists (select 1 from public.app_users au where au.id = u.id);

-- Chuẩn hóa thông tin các tài khoản hệ thống đã tồn tại trong app_users.
update public.app_users au
set email = lower(u.email),
    display_name = coalesce(nullif(p.display_name,''), nullif(u.raw_user_meta_data->>'display_name',''), nullif(u.raw_user_meta_data->>'full_name',''), u.email),
    role = coalesce(r.code, au.role),
    active = coalesce(p.is_active, au.active, true),
    updated_at = now()
from auth.users u
left join public.system_user_profiles p on p.user_id = u.id
left join lateral (
  select sr.code
  from public.system_user_roles sur
  join public.system_roles sr on sr.id = sur.role_id
  where sur.user_id = u.id
  order by case when sr.code='SUPER_ADMIN' then 0 else 1 end
  limit 1
) r on true
where au.id = u.id;
