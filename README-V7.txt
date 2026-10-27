VIET AU PAYROLL — PATCH V7

Phạm vi: sửa nguồn chính sách trong module Quản Lý Kỳ Lương và thống nhất FK payroll_periods.salary_version_id.

Căn cứ schema Sơn cung cấp:
- salary_policy_versions có chính sách ACTIVE L0926.
- salary_versions không có bản ghi.
- payroll_periods.salary_version_id đang FK tới salary_versions.id.
- salary_rate_values.policy_version_id tham chiếu salary_policy_versions.id.

Cài đặt:
1. Sao lưu repository và database.
2. Thay đúng file src/features/payroll-periods/Page.jsx.
3. Đọc và chạy supabase/migrations/20261027_align_payroll_period_policy_fk.sql trong Supabase SQL Editor.
4. Nếu SQL dừng vì dữ liệu kỳ hiện có không khớp, KHÔNG bỏ kiểm tra; gửi nguyên lỗi để đối soát.
5. Chạy npm run build, deploy, làm mới trang và thử dropdown + tạo kỳ nháp.

Migration chỉ đổi đích FK từ salary_versions(id) sang salary_policy_versions(id). Không xóa dữ liệu; không sửa RLS; không sửa FK của salary_rates. Nếu có bản ghi payroll_periods đang trỏ đến ID không tồn tại trong salary_policy_versions, migration dừng trước khi đổi FK.

Chưa được chạy trên Supabase của người dùng và chưa xác nhận build/deploy thành công.
