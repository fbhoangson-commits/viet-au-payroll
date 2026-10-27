-- Chạy truy vấn CHỈ ĐỌC này trong Supabase SQL Editor.
-- Dùng để xác minh schema thực tế trước khi tạo migration sửa lỗi thiếu cột `type`.
-- Không tạo/sửa/xóa bảng, dữ liệu, index hoặc RLS.

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'payroll_periods',
    'payroll_period_employees',
    'payroll_period_custom_columns',
    'payroll_period_custom_values',
    'payroll_period_columns',
    'payroll_period_values',
    'employees'
  )
ORDER BY table_name, ordinal_position;

-- Kiểm tra index hiện có trên payroll_periods (chỉ đọc).
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'payroll_periods'
ORDER BY indexname;

-- Kiểm tra RLS và policy hiện có (chỉ đọc).
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relname IN (
    'payroll_periods',
    'payroll_period_employees',
    'payroll_period_custom_columns',
    'payroll_period_custom_values'
  )
ORDER BY c.relname, p.policyname;
