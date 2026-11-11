-- VIỆT ÂU PAYROLL: đồng bộ quyền dữ liệu dùng chung với RBAC mới.
-- Mục tiêu:
-- 1) SUPER_ADMIN và PAYROLL_ACCOUNTANT cùng đọc/ghi dữ liệu nghiệp vụ theo các policy
--    đang gọi payroll_can_operate().
-- 2) Không thay đổi công thức lương, snapshot, dữ liệu hiện có.
-- 3) payroll_is_super_admin chỉ còn dựa trên RBAC mới.
BEGIN;

CREATE OR REPLACE FUNCTION public.payroll_can_operate()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       public.system_has_role('SUPER_ADMIN')
       OR public.system_has_role('PAYROLL_ACCOUNTANT')
     );
$$;

CREATE OR REPLACE FUNCTION public.payroll_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.system_has_role('SUPER_ADMIN');
$$;

REVOKE ALL ON FUNCTION public.payroll_can_operate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.payroll_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payroll_can_operate() TO authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_is_super_admin() TO authenticated;

-- Employee Master là dữ liệu dùng chung của hệ thống.
-- Thêm policy theo RBAC mới; policy RLS được OR giữa các policy nên không
-- xóa/chạm policy cũ và không làm mất quyền đang có.
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_system_roles_access ON public.employees;
CREATE POLICY employees_system_roles_access
ON public.employees
FOR ALL
TO authenticated
USING (
  public.system_has_role('SUPER_ADMIN')
  OR public.system_has_role('PAYROLL_ACCOUNTANT')
)
WITH CHECK (
  public.system_has_role('SUPER_ADMIN')
  OR public.system_has_role('PAYROLL_ACCOUNTANT')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;

COMMIT;
