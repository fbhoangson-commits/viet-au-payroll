-- Additive migration: monthly actual standards for the three attendance groups.
-- Does not rewrite attendance rows, employee snapshots, RLS policies, or existing constraints.
ALTER TABLE public.daily_attendance_month_settings
  ADD COLUMN IF NOT EXISTS standard_26_days numeric(5,2) NOT NULL DEFAULT 26,
  ADD COLUMN IF NOT EXISTS standard_28_days numeric(5,2) NOT NULL DEFAULT 28;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_attendance_settings_standard_26_check'
      AND conrelid = 'public.daily_attendance_month_settings'::regclass
  ) THEN
    ALTER TABLE public.daily_attendance_month_settings
      ADD CONSTRAINT daily_attendance_settings_standard_26_check
      CHECK (standard_26_days > 0 AND standard_26_days <= 31);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_attendance_settings_standard_28_check'
      AND conrelid = 'public.daily_attendance_month_settings'::regclass
  ) THEN
    ALTER TABLE public.daily_attendance_month_settings
      ADD CONSTRAINT daily_attendance_settings_standard_28_check
      CHECK (standard_28_days > 0 AND standard_28_days <= 31);
  END IF;
END $$;


-- Allow workday_count = 0 to explicitly represent employees in the
-- "Không tính công" group. Keep all non-workday constraints intact.
DO $$ BEGIN
  IF to_regclass('public.salary_workday_norms') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'salary_workday_norms_workday_count_check'
        AND conrelid = 'public.salary_workday_norms'::regclass
    ) THEN
      ALTER TABLE public.salary_workday_norms DROP CONSTRAINT salary_workday_norms_workday_count_check;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'salary_workday_norms_workday_count_nonnegative_check'
        AND conrelid = 'public.salary_workday_norms'::regclass
    ) THEN
      ALTER TABLE public.salary_workday_norms
        ADD CONSTRAINT salary_workday_norms_workday_count_nonnegative_check
        CHECK (workday_count >= 0 AND workday_count <= 31);
    END IF;
  END IF;
END $$;
