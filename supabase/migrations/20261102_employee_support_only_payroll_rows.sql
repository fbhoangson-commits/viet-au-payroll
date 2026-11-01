-- Hỗ trợ riêng: phân biệt nhân sự đã thuộc kỳ lương với nhân sự chỉ được thêm để nhận hỗ trợ.
-- Additive migration; không sửa/xóa các cấu phần lương hiện có.

ALTER TABLE public.payroll_period_employees
  ADD COLUMN IF NOT EXISTS support_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.payroll_period_employee_snapshots
  ADD COLUMN IF NOT EXISTS support_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payroll_period_employees.support_only IS
  'True when this employee was added to this payroll period solely to receive employee support.';
COMMENT ON COLUMN public.payroll_period_employee_snapshots.support_only IS
  'Period snapshot flag: employee receives support only and must not inherit regular payroll components.';

-- Backfill only rows created in the same transaction as their support link by the
-- previous auto-add migration (both created_at values use transaction_timestamp()).
-- Existing payroll members linked to support at a later time remain support_only=false.
UPDATE public.payroll_period_employees pe
SET support_only=true
FROM public.employee_support_period_links l
WHERE l.period_id=pe.period_id
  AND l.employee_id=pe.employee_id
  AND pe.created_at=l.created_at;

UPDATE public.payroll_period_employee_snapshots s
SET support_only=true
FROM public.employee_support_period_links l
WHERE l.period_id=s.period_id
  AND l.employee_id=s.employee_id
  AND s.created_at=l.created_at;

-- Keep the period snapshot synchronized with the membership flag.
UPDATE public.payroll_period_employee_snapshots s
SET support_only=pe.support_only
FROM public.payroll_period_employees pe
WHERE pe.period_id=s.period_id AND pe.employee_id=s.employee_id
  AND s.support_only IS DISTINCT FROM pe.support_only;

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
  v_employee public.employees%rowtype;
  v_period_status text;
  v_employee_code text;
  v_employee_name text;
  v_count integer := 0;
  v_employee_count integer;
  v_support_only boolean;
  v_department text;
  v_position text;
BEGIN
  IF NOT public.payroll_can_operate() THEN
    RAISE EXCEPTION 'Không có quyền đưa khoản hỗ trợ vào kỳ lương';
  END IF;

  SELECT status INTO v_period_status
  FROM public.payroll_periods WHERE id=p_period_id FOR UPDATE;
  IF v_period_status NOT IN ('DRAFT','OPEN') THEN
    RAISE EXCEPTION 'Chỉ được đưa hỗ trợ vào kỳ lương đang mở hoặc bản nháp';
  END IF;
  IF coalesce(array_length(p_support_item_ids,1),0)=0 THEN
    RAISE EXCEPTION 'Chưa chọn khoản hỗ trợ';
  END IF;

  FOREACH v_id IN ARRAY p_support_item_ids LOOP
    SELECT * INTO v_item
    FROM public.employee_support_items
    WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy khoản hỗ trợ %',v_id; END IF;
    IF v_item.status <> 'APPROVED' THEN
      RAISE EXCEPTION 'Khoản hỗ trợ % chưa được duyệt hoặc không còn hợp lệ',v_id;
    END IF;
    IF EXISTS(SELECT 1 FROM public.employee_support_period_links WHERE support_item_id=v_id) THEN
      RAISE EXCEPTION 'Khoản hỗ trợ % đã được đưa vào kỳ lương',v_id;
    END IF;

    v_employee_code := v_item.employee_code;
    v_employee_name := v_item.recipient_name;
    v_support_only := false;
    v_department := NULL;
    v_position := NULL;

    IF v_item.recipient_type='CURRENT' THEN
      IF v_item.employee_id IS NULL THEN
        RAISE EXCEPTION 'Khoản hỗ trợ % chưa gắn mã nhân viên',v_id;
      END IF;
      SELECT * INTO v_employee FROM public.employees WHERE id=v_item.employee_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ nhân sự của khoản hỗ trợ %',v_id;
      END IF;

      v_employee_code := coalesce(
        nullif(to_jsonb(v_employee)->>'employee_code',''),
        nullif(to_jsonb(v_employee)->>'code',''),
        nullif(to_jsonb(v_employee)->>'ma_nhan_vien',''),v_item.employee_code);
      v_employee_name := coalesce(
        nullif(to_jsonb(v_employee)->>'full_name',''),
        nullif(to_jsonb(v_employee)->>'name',''),
        nullif(to_jsonb(v_employee)->>'employee_name',''),v_item.recipient_name);
      v_department := coalesce(to_jsonb(v_employee)->>'department',to_jsonb(v_employee)->>'Phòng Ban');
      v_position := coalesce(to_jsonb(v_employee)->>'position',to_jsonb(v_employee)->>'job_title',to_jsonb(v_employee)->>'Chức Vụ');
      IF coalesce(v_employee_code,'')='' THEN
        RAISE EXCEPTION 'Hồ sơ nhân sự % chưa có mã nhân viên',v_item.employee_id;
      END IF;

      -- Only a newly inserted period member is support-only.
      -- Existing members retain their regular payroll participation.
      SELECT NOT EXISTS(
        SELECT 1 FROM public.payroll_period_employees
        WHERE period_id=p_period_id AND employee_id=v_item.employee_id
      ) INTO v_support_only;

      INSERT INTO public.payroll_period_employees(
        period_id,employee_id,employee_code,employee_name,department,position,support_only
      ) VALUES (
        p_period_id,v_item.employee_id,v_employee_code,v_employee_name,v_department,v_position,v_support_only
      ) ON CONFLICT (period_id,employee_id) DO NOTHING;

      INSERT INTO public.payroll_period_employee_snapshots(
        period_id,employee_id,employee_code_snapshot,employee_name_snapshot,
        department_snapshot,standard_type,standard_days,support_only
      ) VALUES (
        p_period_id,v_item.employee_id,v_employee_code,v_employee_name,
        v_department,NULL,NULL,v_support_only
      ) ON CONFLICT (period_id,employee_id) DO NOTHING;
    END IF;

    INSERT INTO public.employee_support_period_links(
      support_item_id,period_id,employee_id,employee_code_snapshot,
      recipient_name_snapshot,description_snapshot,amount_snapshot,
      tax_amount_snapshot,net_amount_snapshot,recipient_type_snapshot
    ) VALUES (
      v_item.id,p_period_id,v_item.employee_id,v_employee_code,
      v_employee_name,v_item.description,v_item.amount,
      v_item.tax_amount,v_item.net_amount,v_item.recipient_type
    );

    UPDATE public.employee_support_items
    SET status='LINKED',updated_at=now()
    WHERE id=v_id;
    v_count:=v_count+1;
  END LOOP;

  SELECT count(*) INTO v_employee_count
  FROM public.payroll_period_employees WHERE period_id=p_period_id;
  UPDATE public.payroll_periods
  SET employee_count=v_employee_count,updated_at=now()
  WHERE id=p_period_id;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_support_link_to_period(uuid[],uuid) TO authenticated;
