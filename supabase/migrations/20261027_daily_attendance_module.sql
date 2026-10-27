-- WEBAPP LUONG VIET AU - Daily Attendance module
-- Additive migration only: does not delete or rewrite existing payroll data/policies.
-- Requires existing public.payroll_periods, public.employees, payroll_can_operate(), payroll_is_super_admin().

CREATE TABLE IF NOT EXISTS public.payroll_period_employee_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  employee_code_snapshot text NOT NULL,
  employee_name_snapshot text NOT NULL,
  department_snapshot text,
  standard_type text CHECK (standard_type IN ('26', '28', 'NONE')),
  standard_days numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_period_employee_snapshots_period_employee_key UNIQUE (period_id, employee_id),
  CONSTRAINT payroll_period_employee_snapshots_standard_days_check CHECK (
    (standard_type IS NULL AND standard_days IS NULL)
    OR (standard_type = 'NONE' AND standard_days IS NULL)
    OR (standard_type IN ('26', '28') AND standard_days > 0 AND standard_days <= 31)
  )
);

CREATE TABLE IF NOT EXISTS public.daily_attendance_month_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL UNIQUE REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  default_standard_type text NOT NULL DEFAULT '26' CHECK (default_standard_type IN ('26', '28', 'NONE')),
  default_standard_days numeric(5,2),
  notes text,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_attendance_month_settings_standard_days_check CHECK (
    (default_standard_type = 'NONE' AND default_standard_days IS NULL)
    OR (default_standard_type IN ('26', '28') AND default_standard_days > 0 AND default_standard_days <= 31)
  )
);

CREATE TABLE IF NOT EXISTS public.daily_attendance_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  work_units numeric(5,2),
  requires_note boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_attendance_codes_work_units_check CHECK (work_units IS NULL OR (work_units >= 0 AND work_units <= 1))
);

CREATE TABLE IF NOT EXISTS public.daily_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  work_date date NOT NULL,
  attendance_code text NOT NULL,
  note text,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_attendance_records_period_employee_date_key UNIQUE (period_id, employee_id, work_date)
);

CREATE INDEX IF NOT EXISTS payroll_period_employee_snapshots_period_idx ON public.payroll_period_employee_snapshots(period_id);
CREATE INDEX IF NOT EXISTS daily_attendance_records_period_date_idx ON public.daily_attendance_records(period_id, work_date);
CREATE INDEX IF NOT EXISTS daily_attendance_records_period_employee_idx ON public.daily_attendance_records(period_id, employee_id);
CREATE INDEX IF NOT EXISTS daily_attendance_codes_active_order_idx ON public.daily_attendance_codes(is_active, display_order, code);

ALTER TABLE public.payroll_period_employee_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance_month_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_employee_snapshots' AND policyname='daily_attendance_snapshots_select') THEN
    CREATE POLICY daily_attendance_snapshots_select ON public.payroll_period_employee_snapshots FOR SELECT TO authenticated USING (public.payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_employee_snapshots' AND policyname='daily_attendance_snapshots_insert') THEN
    CREATE POLICY daily_attendance_snapshots_insert ON public.payroll_period_employee_snapshots FOR INSERT TO authenticated WITH CHECK (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_period_employee_snapshots' AND policyname='daily_attendance_snapshots_update') THEN
    CREATE POLICY daily_attendance_snapshots_update ON public.payroll_period_employee_snapshots FOR UPDATE TO authenticated USING (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    ) WITH CHECK (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_month_settings' AND policyname='daily_attendance_settings_select') THEN
    CREATE POLICY daily_attendance_settings_select ON public.daily_attendance_month_settings FOR SELECT TO authenticated USING (public.payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_month_settings' AND policyname='daily_attendance_settings_insert') THEN
    CREATE POLICY daily_attendance_settings_insert ON public.daily_attendance_month_settings FOR INSERT TO authenticated WITH CHECK (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_month_settings' AND policyname='daily_attendance_settings_update') THEN
    CREATE POLICY daily_attendance_settings_update ON public.daily_attendance_month_settings FOR UPDATE TO authenticated USING (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    ) WITH CHECK (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_codes' AND policyname='daily_attendance_codes_select') THEN
    CREATE POLICY daily_attendance_codes_select ON public.daily_attendance_codes FOR SELECT TO authenticated USING (public.payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_codes' AND policyname='daily_attendance_codes_insert') THEN
    CREATE POLICY daily_attendance_codes_insert ON public.daily_attendance_codes FOR INSERT TO authenticated WITH CHECK (public.payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_codes' AND policyname='daily_attendance_codes_update') THEN
    CREATE POLICY daily_attendance_codes_update ON public.daily_attendance_codes FOR UPDATE TO authenticated USING (public.payroll_can_operate()) WITH CHECK (public.payroll_can_operate());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_records' AND policyname='daily_attendance_records_select') THEN
    CREATE POLICY daily_attendance_records_select ON public.daily_attendance_records FOR SELECT TO authenticated USING (public.payroll_can_operate());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_records' AND policyname='daily_attendance_records_insert') THEN
    CREATE POLICY daily_attendance_records_insert ON public.daily_attendance_records FOR INSERT TO authenticated WITH CHECK (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_records' AND policyname='daily_attendance_records_update') THEN
    CREATE POLICY daily_attendance_records_update ON public.daily_attendance_records FOR UPDATE TO authenticated USING (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    ) WITH CHECK (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='daily_attendance_records' AND policyname='daily_attendance_records_delete') THEN
    CREATE POLICY daily_attendance_records_delete ON public.daily_attendance_records FOR DELETE TO authenticated USING (
      public.payroll_can_operate() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id=period_id AND p.status <> 'LOCKED')
    );
  END IF;
END $$;

COMMENT ON TABLE public.payroll_period_employee_snapshots IS 'Danh sách nhân sự được chốt cho từng Kỳ Lương; không tự đồng bộ theo Employee Master.';
COMMENT ON TABLE public.daily_attendance_month_settings IS 'Cấu hình công chuẩn theo Kỳ Lương.';
COMMENT ON TABLE public.daily_attendance_codes IS 'Danh mục mã công và hệ số quy đổi được nhà trường cấu hình.';
COMMENT ON TABLE public.daily_attendance_records IS 'Dữ liệu chấm công ngày gắn với Kỳ Lương và nhân sự.';
