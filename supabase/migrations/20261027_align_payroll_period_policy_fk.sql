-- VIET AU PAYROLL - align payroll_periods policy FK with the live policy model
-- Confirmed live schema: salary_policy_versions has ACTIVE policy L0926; salary_versions is empty.
-- Run in Supabase SQL Editor after taking a database backup. Transaction rolls back on any failure.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payroll_periods pp
    LEFT JOIN public.salary_policy_versions spv ON spv.id = pp.salary_version_id
    WHERE spv.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration stopped: payroll_periods contains salary_version_id values with no matching salary_policy_versions.id. Review existing periods before changing the FK.';
  END IF;
END $$;

ALTER TABLE public.payroll_periods
  DROP CONSTRAINT IF EXISTS payroll_periods_salary_version_id_fkey;

ALTER TABLE public.payroll_periods
  ADD CONSTRAINT payroll_periods_salary_version_id_fkey
  FOREIGN KEY (salary_version_id)
  REFERENCES public.salary_policy_versions(id)
  ON UPDATE NO ACTION
  ON DELETE NO ACTION;

COMMIT;
