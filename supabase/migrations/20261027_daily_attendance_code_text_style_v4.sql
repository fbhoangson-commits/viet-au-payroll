-- Chấm Công Ngày V4: persist text color and bold style for attendance codes.
-- Safe to rerun. Existing color values are preserved and now represent text color.
ALTER TABLE public.daily_attendance_codes
  ADD COLUMN IF NOT EXISTS is_bold boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.daily_attendance_codes.color IS
  'Màu chữ mã công dạng HEX; không dùng làm màu nền ô chấm công.';
COMMENT ON COLUMN public.daily_attendance_codes.is_bold IS
  'Bật/tắt chữ đậm khi hiển thị mã công trong Chấm Công Ngày.';
