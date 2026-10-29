-- VIET AU PAYROLL: cho phép lưu trạng thái từ chối của hồ sơ trình duyệt.
-- Trạng thái trình duyệt dùng SUBMITTED (không dùng PENDING vì constraint hiện tại không cho phép).
-- Chạy trong Supabase SQL Editor sau khi xác nhận constraint đang là payroll_runs_status_check.
BEGIN;

ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_status_check;

ALTER TABLE public.payroll_runs
  ADD CONSTRAINT payroll_runs_status_check
  CHECK (status IN (
    'DRAFT',
    'IMPORTED',
    'CALCULATED',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'LOCKED'
  ));

COMMIT;
