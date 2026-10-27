-- WEBAPP LƯƠNG VIỆT ÂU — Mở rộng Khoản Cộng Trừ theo mẫu KHOAN_CONG_TRU_2026-09.xlsx
-- Migration additive: không xóa bảng hoặc dữ liệu hiện có.
begin;

alter table public.payroll_adjustments
  add column if not exists application_type text not null default 'PER_PERIOD',
  add column if not exists quantity numeric(14,4) not null default 1,
  add column if not exists unit text,
  add column if not exists unit_price numeric(14,4) not null default 0,
  add column if not exists period_code text,
  add column if not exists effective_from text,
  add column if not exists effective_to text;

-- Bảo toàn ý nghĩa số tiền của các bản ghi được tạo trước khi có trường Đơn giá.
update public.payroll_adjustments
set unit_price = amount
where unit_price = 0 and amount > 0;

-- Chuẩn hóa các bản ghi cũ theo dạng Theo kỳ, không đổi số tiền hay kỳ gốc.
update public.payroll_adjustments
set application_type = 'PER_PERIOD'
where application_type is null or application_type not in ('FIXED','PER_PERIOD');

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_adjustments'::regclass
      and conname = 'payroll_adjustments_amount_check'
  ) then
    alter table public.payroll_adjustments drop constraint payroll_adjustments_amount_check;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_adjustments'::regclass
      and conname = 'payroll_adjustments_amount_nonnegative_check'
  ) then
    alter table public.payroll_adjustments
      add constraint payroll_adjustments_amount_nonnegative_check check (amount >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payroll_adjustments'::regclass
      and conname = 'payroll_adjustments_application_type_check'
  ) then
    alter table public.payroll_adjustments
      add constraint payroll_adjustments_application_type_check check (application_type in ('FIXED','PER_PERIOD'));
  end if;
end $$;

create index if not exists payroll_adjustments_application_period_idx
  on public.payroll_adjustments(application_type, effective_from, effective_to, period_id);

commit;
