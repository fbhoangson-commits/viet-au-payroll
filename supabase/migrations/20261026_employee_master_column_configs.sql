-- VIỆT ÂU PAYROLL: shared configuration for Employee Master columns.
-- Additive only: no employee rows, existing columns, Auth users, or existing RLS policies are changed.
CREATE TABLE IF NOT EXISTS public.employee_master_column_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  label text NOT NULL,
  data_type text NOT NULL DEFAULT 'text' CHECK (data_type IN ('text','number','date','currency','checkbox','dropdown','multi_select')),
  show_in_list boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_master_column_configs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_master_column_configs TO authenticated;
DO $$ BEGIN CREATE POLICY employee_master_column_configs_select_authenticated ON public.employee_master_column_configs FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY employee_master_column_configs_insert_authenticated ON public.employee_master_column_configs FOR INSERT TO authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY employee_master_column_configs_update_authenticated ON public.employee_master_column_configs FOR UPDATE TO authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY employee_master_column_configs_delete_authenticated ON public.employee_master_column_configs FOR DELETE TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS employee_master_column_configs_order_idx ON public.employee_master_column_configs (display_order, field_key);
CREATE OR REPLACE FUNCTION public.set_employee_master_column_configs_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_employee_master_column_configs_updated_at ON public.employee_master_column_configs;
CREATE TRIGGER trg_employee_master_column_configs_updated_at BEFORE UPDATE ON public.employee_master_column_configs FOR EACH ROW EXECUTE FUNCTION public.set_employee_master_column_configs_updated_at();
