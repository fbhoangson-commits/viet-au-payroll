-- VA-BANK phase 1: separate employee bank profiles + immutable change history.
-- Additive only. Does not modify payroll calculation or Employee Master columns.
CREATE TABLE IF NOT EXISTS public.employee_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE RESTRICT,
  bank_code text NOT NULL DEFAULT 'MSB',
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  branch text,
  notes text,
  is_verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_bank_accounts_bank_code_check CHECK (bank_code IN ('MSB','VCB','BIDV','MB','ACB','TCB','VIB','CTG','OTHER')),
  CONSTRAINT employee_bank_accounts_account_number_check CHECK (length(trim(account_number)) > 0),
  CONSTRAINT employee_bank_accounts_account_holder_check CHECK (length(trim(account_holder)) > 0),
  CONSTRAINT employee_bank_accounts_other_bank_name_check CHECK (bank_code <> 'OTHER' OR length(trim(bank_name)) > 0)
);
CREATE INDEX IF NOT EXISTS employee_bank_accounts_bank_idx ON public.employee_bank_accounts(bank_code);
CREATE INDEX IF NOT EXISTS employee_bank_accounts_verified_idx ON public.employee_bank_accounts(is_verified);

CREATE TABLE IF NOT EXISTS public.employee_bank_account_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bank_account_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE')),
  old_values jsonb,
  new_values jsonb NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_bank_account_history_employee_idx ON public.employee_bank_account_history(employee_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.employee_bank_account_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.updated_by := auth.uid();
    NEW.updated_at := now();
    INSERT INTO public.employee_bank_account_history(bank_account_id,employee_id,action,new_values,actor_id)
    VALUES(NEW.id,NEW.employee_id,'INSERT',to_jsonb(NEW),auth.uid());
    RETURN NEW;
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  INSERT INTO public.employee_bank_account_history(bank_account_id,employee_id,action,old_values,new_values,actor_id)
  VALUES(NEW.id,NEW.employee_id,'UPDATE',to_jsonb(OLD),to_jsonb(NEW),auth.uid());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS employee_bank_account_audit_trigger ON public.employee_bank_accounts;
CREATE TRIGGER employee_bank_account_audit_trigger
BEFORE INSERT OR UPDATE ON public.employee_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.employee_bank_account_audit();

ALTER TABLE public.employee_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bank_account_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_bank_accounts_read ON public.employee_bank_accounts;
CREATE POLICY employee_bank_accounts_read ON public.employee_bank_accounts FOR SELECT TO authenticated
USING (public.system_has_role('SUPER_ADMIN') OR public.system_has_role('PAYROLL_ACCOUNTANT'));
DROP POLICY IF EXISTS employee_bank_accounts_insert ON public.employee_bank_accounts;
CREATE POLICY employee_bank_accounts_insert ON public.employee_bank_accounts FOR INSERT TO authenticated
WITH CHECK (public.system_has_role('SUPER_ADMIN') OR public.system_has_role('PAYROLL_ACCOUNTANT'));
DROP POLICY IF EXISTS employee_bank_accounts_update ON public.employee_bank_accounts;
CREATE POLICY employee_bank_accounts_update ON public.employee_bank_accounts FOR UPDATE TO authenticated
USING (public.system_has_role('SUPER_ADMIN') OR public.system_has_role('PAYROLL_ACCOUNTANT'))
WITH CHECK (public.system_has_role('SUPER_ADMIN') OR public.system_has_role('PAYROLL_ACCOUNTANT'));
DROP POLICY IF EXISTS employee_bank_account_history_read ON public.employee_bank_account_history;
CREATE POLICY employee_bank_account_history_read ON public.employee_bank_account_history FOR SELECT TO authenticated
USING (public.system_has_role('SUPER_ADMIN') OR public.system_has_role('PAYROLL_ACCOUNTANT'));
REVOKE ALL ON public.employee_bank_accounts, public.employee_bank_account_history FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.employee_bank_accounts TO authenticated;
GRANT SELECT ON public.employee_bank_account_history TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.employee_bank_account_history_id_seq TO authenticated;
REVOKE ALL ON FUNCTION public.employee_bank_account_audit() FROM PUBLIC;

COMMENT ON TABLE public.employee_bank_accounts IS 'VA-BANK: hồ sơ tài khoản nhận lương riêng biệt với Employee Master.';
COMMENT ON TABLE public.employee_bank_account_history IS 'VA-BANK: lịch sử thay đổi hồ sơ ngân hàng; lưu dữ liệu cũ/mới để truy vết.';
