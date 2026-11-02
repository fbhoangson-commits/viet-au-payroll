-- VA Support-only integration: additive and scoped to employee-support linking.
-- Does not modify payroll formulas, existing snapshots, or historical payroll runs.

ALTER TABLE public.payroll_period_employee_snapshots
  ADD COLUMN IF NOT EXISTS support_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payroll_period_employee_snapshots.support_only IS
  'True only for a payroll-period row created solely to receive employee support; ordinary salary components are excluded for this row.';

CREATE OR REPLACE FUNCTION public.employee_support_link_to_period(
  p_support_item_ids uuid[],
  p_period_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=public
AS $$
DECLARE
  v_id uuid;
  v_item public.employee_support_items%rowtype;
  v_period_status text;
  v_employee jsonb;
  v_employee_code text;
  v_employee_name text;
  v_department text;
  v_position text;
  v_count integer := 0;
  v_employee_count integer;
  v_had_membership boolean;
  v_exclude_insurance boolean;
  v_exclude_tax boolean;
BEGIN
  IF NOT public.payroll_can_operate() THEN
    RAISE EXCEPTION 'Không có quyền đưa khoản hỗ trợ vào kỳ lương';
  END IF;

  SELECT status INTO v_period_status
  FROM public.payroll_periods WHERE id=p_period_id FOR UPDATE;
  IF v_period_status NOT IN ('DRAFT','OPEN') THEN
    RAISE EXCEPTION 'Chỉ được đưa hỗ trợ vào kỳ lương đang mở hoặc bản nháp';
  END IF;
  IF COALESCE(array_length(p_support_item_ids,1),0)=0 THEN
    RAISE EXCEPTION 'Chưa chọn khoản hỗ trợ';
  END IF;

  FOREACH v_id IN ARRAY p_support_item_ids LOOP
    SELECT * INTO v_item FROM public.employee_support_items WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy khoản hỗ trợ %',v_id; END IF;
    IF v_item.status <> 'APPROVED' THEN
      RAISE EXCEPTION 'Khoản hỗ trợ % chưa được duyệt hoặc không còn hợp lệ',v_id;
    END IF;
    IF EXISTS(SELECT 1 FROM public.employee_support_period_links WHERE support_item_id=v_id) THEN
      RAISE EXCEPTION 'Khoản hỗ trợ % đã được đưa vào kỳ lương',v_id;
    END IF;

    -- A recipient tied to Employee Master is added to the payroll period if absent.
    IF v_item.employee_id IS NOT NULL THEN
      SELECT to_jsonb(e) INTO v_employee FROM public.employees e WHERE e.id=v_item.employee_id FOR SHARE;
      IF v_employee IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ Employee Master của khoản hỗ trợ %',v_id;
      END IF;
      v_employee_code := COALESCE(NULLIF(v_item.employee_code,''), NULLIF(v_employee->>'employee_code',''), NULLIF(v_employee->>'code',''));
      v_employee_name := COALESCE(NULLIF(v_item.recipient_name,''), NULLIF(v_employee->>'full_name',''), NULLIF(v_employee->>'employee_name',''), NULLIF(v_employee->>'name',''), v_employee_code);
      v_department := COALESCE(NULLIF(v_employee->>'department',''), NULLIF(v_employee->>'Phòng Ban',''));
      v_position := COALESCE(NULLIF(v_employee->>'position',''), NULLIF(v_employee->>'job_title',''), NULLIF(v_employee->>'Chức Vụ',''));
      IF v_employee_code IS NULL OR v_employee_name IS NULL THEN
        RAISE EXCEPTION 'Thiếu mã hoặc tên nhân sự trong Employee Master cho khoản hỗ trợ %',v_id;
      END IF;

      SELECT (
        EXISTS(SELECT 1 FROM public.payroll_period_employees WHERE period_id=p_period_id AND employee_id=v_item.employee_id)
        OR EXISTS(SELECT 1 FROM public.payroll_period_employee_snapshots WHERE period_id=p_period_id AND employee_id=v_item.employee_id)
      ) INTO v_had_membership;

      IF NOT v_had_membership THEN
        INSERT INTO public.payroll_period_employees(
          period_id,employee_id,employee_code,employee_name,department,position
        ) VALUES (
          p_period_id,v_item.employee_id,v_employee_code,v_employee_name,v_department,v_position
        ) ON CONFLICT (period_id,employee_id) DO NOTHING;

        INSERT INTO public.payroll_period_employee_snapshots(
          period_id,employee_id,employee_code_snapshot,employee_name_snapshot,
          department_snapshot,standard_type,standard_days,exclude_insurance,exclude_tax,support_only
        ) VALUES (
          p_period_id,v_item.employee_id,v_employee_code,v_employee_name,
          v_department,'NONE',NULL,true,true,true
        ) ON CONFLICT (period_id,employee_id) DO NOTHING;
      ELSE
        -- Existing membership OR snapshot means this is a normal payroll employee: never mark support-only.
        SELECT COALESCE(exclude_insurance,false),COALESCE(exclude_tax,false)
          INTO v_exclude_insurance,v_exclude_tax
        FROM public.payroll_period_employees
        WHERE period_id=p_period_id AND employee_id=v_item.employee_id;

        INSERT INTO public.payroll_period_employees(
          period_id,employee_id,employee_code,employee_name,department,position
        ) VALUES (
          p_period_id,v_item.employee_id,v_employee_code,v_employee_name,v_department,v_position
        ) ON CONFLICT (period_id,employee_id) DO NOTHING;

        INSERT INTO public.payroll_period_employee_snapshots(
          period_id,employee_id,employee_code_snapshot,employee_name_snapshot,
          department_snapshot,standard_type,standard_days,exclude_insurance,exclude_tax,support_only
        ) VALUES (
          p_period_id,v_item.employee_id,v_employee_code,v_employee_name,
          v_department,'NONE',NULL,COALESCE(v_exclude_insurance,false),COALESCE(v_exclude_tax,false),false
        ) ON CONFLICT (period_id,employee_id) DO NOTHING;
      END IF;
    END IF;

    INSERT INTO public.employee_support_period_links(
      support_item_id,period_id,employee_id,employee_code_snapshot,
      recipient_name_snapshot,description_snapshot,amount_snapshot,
      tax_amount_snapshot,net_amount_snapshot,recipient_type_snapshot
    ) VALUES (
      v_item.id,p_period_id,v_item.employee_id,v_item.employee_code,
      v_item.recipient_name,v_item.description,v_item.amount,
      v_item.tax_amount,v_item.net_amount,v_item.recipient_type
    );

    UPDATE public.employee_support_items SET status='LINKED',updated_at=now()
    WHERE id=v_id;
    v_count:=v_count+1;
  END LOOP;

  SELECT count(*) INTO v_employee_count
  FROM public.payroll_period_employees WHERE period_id=p_period_id;
  UPDATE public.payroll_periods SET employee_count=v_employee_count,updated_at=now()
  WHERE id=p_period_id;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_support_link_to_period(uuid[],uuid) TO authenticated;
