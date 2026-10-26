-- VIỆT ÂU PAYROLL: dynamic employee fields for Excel headers
-- Safe additive migration only: does not delete or rename existing columns/data.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS custom_field_order jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.employees.custom_fields IS 'Dynamic employee profile fields imported from Excel headers';
COMMENT ON COLUMN public.employees.custom_field_order IS 'Ordered list of dynamic/imported employee field headers';
