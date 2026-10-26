-- WEBAPP LƯƠNG VIỆT ÂU — Định Mức Lương (migration đã chỉnh theo schema hiện có)
-- Đọc kỹ trước khi chạy. Không xóa bảng/dữ liệu hiện có.
-- Tái sử dụng salary_rate_groups và salary_rate_values hiện có.
-- Không tạo bảng employee_salary_rates song song.

begin;

-- Bảng nhóm đã tồn tại với name, sort_order, active.
-- Bổ sung code ổn định để ánh xạ nhóm; giữ nguyên các cột cũ.
alter table public.salary_rate_groups
  add column if not exists code text;

-- Gán code cho nhóm hiện có khi code đang trống; không ghi đè code đã có.
update public.salary_rate_groups
set code = case
  when lower(trim(name)) in ('cố định', 'co dinh') then 'FIXED'
  when lower(trim(name)) = 'tiết dạy' then 'TEACHING'
  when lower(trim(name)) = 'phụ đạo' then 'TUTORING'
  when lower(trim(name)) = 'khác' then 'OTHER'
  else 'GROUP_' || upper(replace(id::text, '-', ''))
end
where code is null or trim(code) = '';

alter table public.salary_rate_groups
  alter column code set not null;

create unique index if not exists salary_rate_groups_code_uidx
  on public.salary_rate_groups(code);

-- Dùng bảng cột riêng cho các thành phần trong từng nhóm.
create table if not exists public.salary_rate_columns (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.salary_rate_groups(id) on delete restrict,
  code text not null unique,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists salary_rate_columns_group_order_idx
  on public.salary_rate_columns(group_id, display_order);

alter table public.salary_rate_columns enable row level security;

-- Chỉ thiết lập policy cho bảng cột mới; không thay đổi policy của bảng nhóm hoặc dữ liệu lương hiện có.
drop policy if exists salary_rate_columns_select_authenticated on public.salary_rate_columns;
create policy salary_rate_columns_select_authenticated
  on public.salary_rate_columns for select to authenticated using (true);

drop policy if exists salary_rate_columns_write_authenticated on public.salary_rate_columns;
create policy salary_rate_columns_write_authenticated
  on public.salary_rate_columns for all to authenticated using (true) with check (true);

-- Seed nhóm mặc định: tương thích với sort_order và active hiện có.
-- Không ghi đè tên/thứ tự/trạng thái các nhóm đã tồn tại.
insert into public.salary_rate_groups (code, name, sort_order, active)
values
  ('FIXED', 'Cố Định', 1, true),
  ('TEACHING', 'Tiết dạy', 2, true),
  ('TUTORING', 'Phụ đạo', 3, true),
  ('OTHER', 'Khác', 4, true)
on conflict (code) do nothing;

-- Seed các cột mặc định; không cập nhật các cột đã tồn tại.
insert into public.salary_rate_columns (group_id, code, name, display_order)
select g.id, seed.code, seed.name, seed.display_order
from (values
 ('FIXED','BASE_SALARY','Lương Cơ Bản',1),
 ('FIXED','SENIORITY','Thâm Niên',2),
 ('FIXED','SENIORITY_2026','Thâm Niên 2026',3),
 ('FIXED','ALLOWANCE','Phụ Cấp',4),
 ('TEACHING','GRADE_10','Khối 10',1),
 ('TEACHING','GRADE_11','Khối 11',2),
 ('TEACHING','GRADE_12','Khối 12',3),
 ('TUTORING','AFTERNOON','Chiều',1),
 ('TUTORING','EVENING','Tối',2),
 ('TUTORING','SATURDAY','Thứ 7',3),
 ('TUTORING','SUNDAY','Chủ Nhật',4),
 ('OTHER','EXAM_DUTY','Coi Thi',1),
 ('OTHER','IELTS','IELTS',2),
 ('OTHER','TEACHING_ASSISTANT','Trợ Giảng',3)
) as seed(group_code, code, name, display_order)
join public.salary_rate_groups g on g.code = seed.group_code
on conflict (code) do nothing;

commit;

-- LƯU Ý:
-- salary_rate_values đã tồn tại và lưu values dạng JSONB theo employee_id/group_id/policy_version_id.
-- Chưa tạo employee_salary_rates và chưa tự chuyển đổi dữ liệu JSONB sang dạng từng cột.
-- Trước khi kết nối giao diện, kiểm tra chính xác cấu trúc/RLS của salary_rate_values,
-- khóa nhân sự trong Employee Master và chính sách RLS hiện tại.
