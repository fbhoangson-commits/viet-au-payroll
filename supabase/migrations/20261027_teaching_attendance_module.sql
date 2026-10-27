-- VIỆT ÂU PAYROLL — Chấm Công Tiết Dạy
-- Additive only. Stores only lesson counts; rates remain sourced from salary_rate_values.
-- Run after the salary-rates and daily-attendance migrations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.teaching_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  salary_rate_column_id uuid NOT NULL REFERENCES public.salary_rate_columns(id) ON DELETE RESTRICT,
  lesson_count numeric(10,2) NOT NULL DEFAULT 0 CHECK (lesson_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teaching_attendance_records_period_employee_column_key
    UNIQUE (period_id, employee_id, salary_rate_column_id)
);

CREATE INDEX IF NOT EXISTS teaching_attendance_records_period_employee_idx
  ON public.teaching_attendance_records(period_id, employee_id);
CREATE INDEX IF NOT EXISTS teaching_attendance_records_column_idx
  ON public.teaching_attendance_records(salary_rate_column_id);

ALTER TABLE public.teaching_attendance_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='teaching_attendance_records'
      AND policyname='teaching_attendance_select'
  ) THEN
    CREATE POLICY teaching_attendance_select
      ON public.teaching_attendance_records FOR SELECT TO authenticated
      USING (public.payroll_can_operate());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='teaching_attendance_records'
      AND policyname='teaching_attendance_insert'
  ) THEN
    CREATE POLICY teaching_attendance_insert
      ON public.teaching_attendance_records FOR INSERT TO authenticated
      WITH CHECK (
        public.payroll_can_operate()
        AND EXISTS (
          SELECT 1 FROM public.payroll_periods p
          WHERE p.id = period_id AND p.status <> 'LOCKED'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='teaching_attendance_records'
      AND policyname='teaching_attendance_update'
  ) THEN
    CREATE POLICY teaching_attendance_update
      ON public.teaching_attendance_records FOR UPDATE TO authenticated
      USING (
        public.payroll_can_operate()
        AND EXISTS (
          SELECT 1 FROM public.payroll_periods p
          WHERE p.id = period_id AND p.status <> 'LOCKED'
        )
      )
      WITH CHECK (
        public.payroll_can_operate()
        AND EXISTS (
          SELECT 1 FROM public.payroll_periods p
          WHERE p.id = period_id AND p.status <> 'LOCKED'
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.teaching_attendance_records TO authenticated;

COMMENT ON TABLE public.teaching_attendance_records IS
  'Số tiết theo kỳ, nhân sự và định danh cột salary_rate_columns; đơn giá đọc từ salary_rate_values.';

COMMIT;
