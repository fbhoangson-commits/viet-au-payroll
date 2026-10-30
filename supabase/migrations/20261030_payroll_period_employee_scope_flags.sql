-- Add per-period participation flags without changing Employee Master or historical payroll runs.
ALTER TABLE public.payroll_period_employees
  ADD COLUMN IF NOT EXISTS exclude_insurance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS period_note text;

ALTER TABLE public.payroll_period_employee_snapshots
  ADD COLUMN IF NOT EXISTS exclude_insurance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS period_note text;

COMMENT ON COLUMN public.payroll_period_employees.exclude_insurance IS
  'When true, this employee is excluded from insurance calculations for this payroll period only.';
COMMENT ON COLUMN public.payroll_period_employees.exclude_tax IS
  'When true, this employee is excluded from personal income tax calculations for this payroll period only.';
COMMENT ON COLUMN public.payroll_period_employee_snapshots.exclude_insurance IS
  'Period-scoped insurance exclusion flag mirrored from payroll_period_employees.';
COMMENT ON COLUMN public.payroll_period_employee_snapshots.exclude_tax IS
  'Period-scoped PIT exclusion flag mirrored from payroll_period_employees.';
