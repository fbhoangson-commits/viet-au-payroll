-- Additive migration: switch new workday norms to employee-level keys.
-- Existing position-based rows are preserved for audit/history.
ALTER TABLE public.salary_workday_norms
  ADD COLUMN IF NOT EXISTS employee_id uuid;

-- Legacy position columns remain in place, but employee-based rows do not need them.
ALTER TABLE public.salary_workday_norms
  ALTER COLUMN position_key DROP NOT NULL,
  ALTER COLUMN position_name DROP NOT NULL;

-- A given employee has at most one workday norm per salary policy.
CREATE UNIQUE INDEX IF NOT EXISTS salary_workday_norms_policy_employee_uidx
  ON public.salary_workday_norms (policy_version_id, employee_id);

CREATE INDEX IF NOT EXISTS salary_workday_norms_employee_idx
  ON public.salary_workday_norms (employee_id);
