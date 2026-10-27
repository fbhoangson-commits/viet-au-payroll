-- WEBAPP LƯƠNG VIỆT ÂU — Quản Lý Kỳ Lương schema alignment
-- Idempotent migration. Preserves existing payroll_periods rows and existing RLS policies.
-- Review before running in production. Run once in Supabase SQL Editor.
BEGIN;

-- Align the existing table with the module while retaining legacy columns and values.
ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS month text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS employee_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- salary_version_id remains required and is supplied by the module from salary_policy_versions.

-- Backfill the module fields from the existing legacy columns without overwriting populated values.
UPDATE public.payroll_periods
SET code = COALESCE(NULLIF(code, ''), period_code),
    type = COALESCE(NULLIF(type, ''), 'FIXED'),
    name = COALESCE(NULLIF(name, ''), 'Kỳ lương tháng ' || lpad(period_month::text, 2, '0') || '/' || period_year::text),
    month = COALESCE(NULLIF(month, ''), period_year::text || '-' || lpad(period_month::text, 2, '0')),
    start_date = COALESCE(start_date, make_date(period_year, period_month, 1)),
    updated_at = COALESCE(updated_at, created_at, now());

-- Keep legacy code column synchronized for older screens and integrations.
UPDATE public.payroll_periods SET period_code = code WHERE period_code IS DISTINCT FROM code;

ALTER TABLE public.payroll_periods
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN type SET DEFAULT 'FIXED',
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN name SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_periods_type_check' AND conrelid = 'public.payroll_periods'::regclass) THEN
    ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_type_check CHECK (type IN ('FIXED','EVENT'));
  END IF;
END $$;

-- Existing unique(year, month) allowed only one period of any kind per month.
-- Replace it with one fixed monthly period per month; events can share a month.
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_period_year_period_month_key;
DROP INDEX IF EXISTS public.payroll_periods_period_year_period_month_key;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_one_fixed_month_uidx
  ON public.payroll_periods (period_year, period_month) WHERE type = 'FIXED';
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_code_uidx ON public.payroll_periods (code);

-- Snapshot membership for fixed periods. No attendance/payroll data is copied.
CREATE TABLE IF NOT EXISTS public.payroll_period_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  employee_code text NOT NULL,
  employee_name text,
  department text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);

-- Configurable columns and values for event periods.
CREATE TABLE IF NOT EXISTS public.payroll_period_custom_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  data_type text NOT NULL DEFAULT 'currency' CHECK (data_type IN ('currency','number','text','date')),
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, key)
);

CREATE TABLE IF NOT EXISTS public.payroll_period_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  employee_code text NOT NULL,
  employee_name text,
  data_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS payroll_period_employees_period_idx ON public.payroll_period_employees(period_id);
CREATE INDEX IF NOT EXISTS payroll_period_custom_columns_period_idx ON public.payroll_period_custom_columns(period_id, display_order);
CREATE INDEX IF NOT EXISTS payroll_period_custom_values_period_idx ON public.payroll_period_custom_values(period_id);

-- Enable RLS on newly introduced tables. Do not modify existing payroll_periods policies.
ALTER TABLE public.payroll_period_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_period_custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_period_custom_values ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_employees' AND policyname='payroll_period_employees_select') THEN
    CREATE POLICY payroll_period_employees_select ON public.payroll_period_employees FOR SELECT TO authenticated USING (payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_employees' AND policyname='payroll_period_employees_insert') THEN
    CREATE POLICY payroll_period_employees_insert ON public.payroll_period_employees FOR INSERT TO authenticated WITH CHECK (payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_custom_columns' AND policyname='payroll_period_custom_columns_select') THEN
    CREATE POLICY payroll_period_custom_columns_select ON public.payroll_period_custom_columns FOR SELECT TO authenticated USING (payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_custom_columns' AND policyname='payroll_period_custom_columns_insert') THEN
    CREATE POLICY payroll_period_custom_columns_insert ON public.payroll_period_custom_columns FOR INSERT TO authenticated WITH CHECK (payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_custom_columns' AND policyname='payroll_period_custom_columns_update') THEN
    CREATE POLICY payroll_period_custom_columns_update ON public.payroll_period_custom_columns FOR UPDATE TO authenticated USING (payroll_can_operate()) WITH CHECK (payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_custom_values' AND policyname='payroll_period_custom_values_select') THEN
    CREATE POLICY payroll_period_custom_values_select ON public.payroll_period_custom_values FOR SELECT TO authenticated USING (payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_custom_values' AND policyname='payroll_period_custom_values_insert') THEN
    CREATE POLICY payroll_period_custom_values_insert ON public.payroll_period_custom_values FOR INSERT TO authenticated WITH CHECK (payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_custom_values' AND policyname='payroll_period_custom_values_update') THEN
    CREATE POLICY payroll_period_custom_values_update ON public.payroll_period_custom_values FOR UPDATE TO authenticated USING (payroll_can_operate()) WITH CHECK (payroll_can_operate());
  END IF;
END $$;

COMMIT;
