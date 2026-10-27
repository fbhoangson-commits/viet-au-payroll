# Khoản Bổ Sung

Route: `/payroll-adjustments`.

Gồm hai nghiệp vụ: Khoản Cộng Trừ theo kỳ lương và hồ sơ Tạm Ứng/kế hoạch thu hồi.

Migration bổ sung: `supabase/migrations/20261027_payroll_adjustments_and_advances.sql`.

Lưu ý: kế hoạch thu hồi hiện được lưu riêng, chưa tự động khấu trừ vào module TÍNH LƯƠNG. Cần tích hợp và kiểm thử cùng module tính lương sau khi xác minh schema và quy tắc hiện hành.
