WEBAPP LƯƠNG VIỆT ÂU — PATCH V6: FIX SALARY VERSION FOREIGN KEY

Phạm vi: chỉ thay src/features/payroll-periods/Page.jsx.

Nguyên nhân đã xác minh từ schema Supabase:
- payroll_periods.salary_version_id tham chiếu public.salary_versions(id).
- Mã cũ lại tải dropdown từ public.salary_policy_versions và dùng các trường code/name.
- Do đó ID được gửi khi tạo kỳ không thuộc bảng đích của khóa ngoại.

Sửa trong V6:
- Tải danh sách từ public.salary_versions.
- Dùng đúng các trường version_code, version_name, effective_from, effective_to, status.
- Tiếp tục yêu cầu chọn chính sách ACTIVE và lưu ID vào salary_version_id.
- Không sửa schema, không sửa/xóa khóa ngoại, không sửa RLS, không thay đổi module khác.

Cài đặt:
1. Sao lưu source hiện tại.
2. Giải nén ZIP tại thư mục gốc repository và ghi đè đúng file src/features/payroll-periods/Page.jsx.
3. Chạy npm run build.
4. Triển khai thử, tải lại trang, chọn một salary_versions đang ACTIVE rồi tạo kỳ nháp.

Lưu ý:
- Không cần chạy SQL migration cho bản vá này.
- Bản ZIP chỉ chứa file thay đổi và hướng dẫn.
- Chưa chạy build trong môi trường của người dùng; cần xác minh bằng npm run build trước khi deploy.
