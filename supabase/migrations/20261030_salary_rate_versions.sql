-- Additive, non-destructive salary-rate versioning.
-- Run after the existing salary policy and salary-rate migrations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.salary_rate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id uuid NOT NULL REFERENCES public.salary_policy_versions(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  parent_version_id uuid REFERENCES public.salary_rate_versions(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
  groups_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(policy_version_id, code)
);

CREATE TABLE IF NOT EXISTS public.salary_rate_version_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_version_id uuid NOT NULL REFERENCES public.salary_rate_versions(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES public.salary_rate_groups(id) ON UPDATE NO ACTION ON DELETE RESTRICT,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rate_version_id, employee_id, group_id)
);

ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS salary_rate_version_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payroll_periods_salary_rate_version_id_fkey') THEN
    ALTER TABLE public.payroll_periods
      ADD CONSTRAINT payroll_periods_salary_rate_version_id_fkey
      FOREIGN KEY (salary_rate_version_id) REFERENCES public.salary_rate_versions(id)
      ON UPDATE NO ACTION ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.salary_rate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_rate_version_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salary_rate_versions_select_authenticated ON public.salary_rate_versions;
CREATE POLICY salary_rate_versions_select_authenticated ON public.salary_rate_versions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS salary_rate_versions_write_authenticated ON public.salary_rate_versions;
CREATE POLICY salary_rate_versions_write_authenticated ON public.salary_rate_versions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS salary_rate_version_values_select_authenticated ON public.salary_rate_version_values;
CREATE POLICY salary_rate_version_values_select_authenticated ON public.salary_rate_version_values
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS salary_rate_version_values_write_authenticated ON public.salary_rate_version_values;
CREATE POLICY salary_rate_version_values_write_authenticated ON public.salary_rate_version_values
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create one initial rate version per existing salary policy and copy the legacy values.
DO $$
DECLARE p record; v_id uuid; v_code text; v_name text;
BEGIN
  FOR p IN SELECT id, code, name FROM public.salary_policy_versions LOOP
    SELECT id INTO v_id FROM public.salary_rate_versions
      WHERE policy_version_id=p.id ORDER BY created_at LIMIT 1;
    IF v_id IS NULL THEN
      v_code := COALESCE(NULLIF(p.code,''),'POLICY') || '-DM01';
      v_name := COALESCE(NULLIF(p.name,''),p.code,'Chính sách') || ' · Định mức 01';
      INSERT INTO public.salary_rate_versions
        (policy_version_id,code,name,description,groups_snapshot,columns_snapshot)
      VALUES (
        p.id,v_code,v_name,'Phiên bản khởi tạo từ dữ liệu định mức hiện có',
        COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.sort_order,g.name) FROM public.salary_rate_groups g),'[]'::jsonb),
        COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.display_order,c.name) FROM public.salary_rate_columns c),'[]'::jsonb)
      ) RETURNING id INTO v_id;
      INSERT INTO public.salary_rate_version_values(rate_version_id,employee_id,group_id,values,created_at,updated_at)
      SELECT v_id,employee_id,group_id,COALESCE(values,'{}'::jsonb),COALESCE(created_at,now()),COALESCE(updated_at,now())
      FROM public.salary_rate_values WHERE policy_version_id=p.id
      ON CONFLICT(rate_version_id,employee_id,group_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Attach existing periods to the initial version belonging to their current policy.
UPDATE public.payroll_periods pp
SET salary_rate_version_id = (
  SELECT srv.id FROM public.salary_rate_versions srv
  WHERE srv.policy_version_id=pp.salary_version_id
  ORDER BY srv.created_at,srv.id LIMIT 1
)
WHERE pp.salary_rate_version_id IS NULL;

CREATE OR REPLACE FUNCTION public.guard_salary_rate_version_value_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.rate_version_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := OLD.rate_version_id;
  ELSE
    v_id := NEW.rate_version_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payroll_periods pp
    WHERE pp.salary_rate_version_id=v_id
      AND upper(COALESCE(pp.status,'')) IN ('CLOSED','LOCKED')
  ) OR (TG_OP='UPDATE' AND EXISTS (
    SELECT 1 FROM public.payroll_periods pp
    WHERE pp.salary_rate_version_id=NEW.rate_version_id
      AND upper(COALESCE(pp.status,'')) IN ('CLOSED','LOCKED')
  )) THEN
    RAISE EXCEPTION 'Phiên bản định mức đã được kỳ lương khóa sử dụng; không thể sửa hoặc xóa.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_guard_salary_rate_version_value_write ON public.salary_rate_version_values;
CREATE TRIGGER trg_guard_salary_rate_version_value_write
BEFORE INSERT OR UPDATE OR DELETE ON public.salary_rate_version_values
FOR EACH ROW EXECUTE FUNCTION public.guard_salary_rate_version_value_write();

CREATE OR REPLACE FUNCTION public.guard_salary_rate_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payroll_periods pp
    WHERE pp.salary_rate_version_id=OLD.id
      AND upper(COALESCE(pp.status,'')) IN ('CLOSED','LOCKED')
  ) THEN
    RAISE EXCEPTION 'Phiên bản định mức đã được kỳ lương khóa sử dụng; không thể sửa hoặc xóa.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_guard_salary_rate_version_update ON public.salary_rate_versions;
CREATE TRIGGER trg_guard_salary_rate_version_update
BEFORE UPDATE OR DELETE ON public.salary_rate_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_salary_rate_version_update();


-- A closed period cannot be reassigned to another rate version or policy.
CREATE OR REPLACE FUNCTION public.guard_closed_period_rate_version()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE'
     AND upper(COALESCE(OLD.status,'')) IN ('CLOSED','LOCKED')
     AND (NEW.salary_rate_version_id IS DISTINCT FROM OLD.salary_rate_version_id
          OR NEW.salary_version_id IS DISTINCT FROM OLD.salary_version_id) THEN
    RAISE EXCEPTION 'Kỳ lương đã khóa; không thể thay đổi chính sách hoặc phiên bản định mức.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_closed_period_rate_version ON public.payroll_periods;
CREATE TRIGGER trg_guard_closed_period_rate_version
BEFORE UPDATE ON public.payroll_periods
FOR EACH ROW EXECUTE FUNCTION public.guard_closed_period_rate_version();


-- Atomic copy operation: the version and all value rows are created in one transaction.
CREATE OR REPLACE FUNCTION public.clone_salary_rate_version(p_source_version_id uuid, p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE src public.salary_rate_versions%ROWTYPE; new_id uuid; next_no integer; new_code text;
BEGIN
  IF NULLIF(trim(p_name),'') IS NULL THEN
    RAISE EXCEPTION 'Tên phiên bản định mức không được để trống.';
  END IF;
  SELECT * INTO src FROM public.salary_rate_versions WHERE id=p_source_version_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy phiên bản định mức nguồn.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(src.policy_version_id::text));
  SELECT count(*)+1 INTO next_no FROM public.salary_rate_versions WHERE policy_version_id=src.policy_version_id;
  SELECT COALESCE(NULLIF(code,''),'POLICY') INTO new_code FROM public.salary_policy_versions WHERE id=src.policy_version_id;
  new_code := new_code || '-DM' || lpad(next_no::text,2,'0');
  INSERT INTO public.salary_rate_versions
    (policy_version_id,code,name,description,parent_version_id,groups_snapshot,columns_snapshot,created_by)
  VALUES
    (src.policy_version_id,new_code,trim(p_name),'Sao chép từ '||src.name||' ('||src.code||')',src.id,
     src.groups_snapshot,src.columns_snapshot,auth.uid())
  RETURNING id INTO new_id;
  INSERT INTO public.salary_rate_version_values(rate_version_id,employee_id,group_id,values)
  SELECT new_id,employee_id,group_id,values
  FROM public.salary_rate_version_values WHERE rate_version_id=src.id;
  RETURN new_id;
END $$;


CREATE OR REPLACE FUNCTION public.validate_period_salary_rate_version()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.salary_rate_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.salary_rate_versions srv
    WHERE srv.id=NEW.salary_rate_version_id
      AND srv.policy_version_id=NEW.salary_version_id
  ) THEN
    RAISE EXCEPTION 'Phiên bản định mức không thuộc Chính Sách Lương đã chọn.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_period_salary_rate_version ON public.payroll_periods;
CREATE TRIGGER trg_validate_period_salary_rate_version
BEFORE INSERT OR UPDATE OF salary_rate_version_id,salary_version_id ON public.payroll_periods
FOR EACH ROW EXECUTE FUNCTION public.validate_period_salary_rate_version();

REVOKE ALL ON FUNCTION public.clone_salary_rate_version(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_salary_rate_version(uuid,text) TO authenticated;

COMMIT;
