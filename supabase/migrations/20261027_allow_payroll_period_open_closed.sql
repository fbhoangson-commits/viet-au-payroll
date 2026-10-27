-- VIET AU PAYROLL: allow the existing UI lifecycle states OPEN and CLOSED.
-- Preserves all existing workflow states and does not change RLS policies.
BEGIN;

ALTER TABLE public.payroll_periods
  DROP CONSTRAINT IF EXISTS payroll_periods_status_check;

ALTER TABLE public.payroll_periods
  ADD CONSTRAINT payroll_periods_status_check
  CHECK (status = ANY (ARRAY[
    'DRAFT'::text,
    'OPEN'::text,
    'CLOSED'::text,
    'IMPORTED'::text,
    'CALCULATED'::text,
    'SUBMITTED'::text,
    'APPROVED'::text,
    'LOCKED'::text
  ]));

COMMIT;
