-- WEBAPP LƯƠNG VIỆT ÂU
-- Chính Sách Lương: enforce unique policy codes without changing existing rows,
-- foreign keys, RLS policies, or payroll calculation logic.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.salary_policy_versions
    WHERE NULLIF(BTRIM(code), '') IS NOT NULL
    GROUP BY UPPER(BTRIM(code))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Không thể tạo unique index: salary_policy_versions đang có mã chính sách trùng nhau (không phân biệt chữ hoa/thường). Hãy rà soát các mã trùng trước; migration không tự sửa hoặc xóa dữ liệu.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS salary_policy_versions_code_unique
  ON public.salary_policy_versions (UPPER(BTRIM(code)))
  WHERE NULLIF(BTRIM(code), '') IS NOT NULL;
