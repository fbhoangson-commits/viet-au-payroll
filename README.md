# VA16 – FIX DỮ LIỆU CHUNG + MENU THEO QUYỀN + SIDEBAR + ĐỒNG BỘ TÀI KHOẢN

## 1. Dữ liệu chung
Không tạo dữ liệu riêng cho Kế toán. Kế toán tiếp tục đọc cùng bảng production với Super Admin.

## 2. Đồng bộ tài khoản
Chạy SQL migration:
`supabase/migrations/20261111_sync_app_users_rbac.sql`

Migration bổ sung các Auth user hiện có nhưng thiếu `public.app_users`, đồng thời đồng bộ email/display_name/role/active.

Edge Function `system-admin-users` được bổ sung ghi `app_users` khi tạo tài khoản mới.

## 3. Menu
`PAYROLL_ACCOUNTANT` chỉ hiển thị các menu nghiệp vụ được cấp và Nhật ký hoạt động. Các menu cấu hình lương và quản trị hệ thống không được cấp sẽ bị ẩn.

SUPER_ADMIN vẫn thấy toàn bộ menu.

## 4. Sidebar
Chỉ mở một nhóm menu tại một thời điểm. Khi chọn nhóm khác, nhóm đang mở tự thu lại. Khi query tìm kiếm thì các nhóm phù hợp vẫn mở để hiển thị kết quả.

## 5. Chênh lệch Đang làm việc
Dashboard trước đây không bung `custom_fields` trước khi kiểm tra trạng thái, trong khi Employee Master có bung `custom_fields`. Patch chuẩn hóa dữ liệu trạng thái trước khi tính KPI, tránh trường hợp Master 143 đang làm việc nhưng Dashboard 146.

## 6. Lưu ý triển khai
- Chạy SQL trên Supabase Production.
- Deploy lại Edge Function `system-admin-users`.
- Deploy frontend.
- Đăng xuất/đăng nhập lại tài khoản Kế toán để tải lại role và menu.
- Không thay đổi PayrollCalculationPage hoặc công thức tính lương.

## 7. Kiểm thử
Build chưa được xác nhận trong môi trường đóng gói này vì source không có `node_modules` và lần cài dependencies bị timeout. Không coi đây là xác nhận build thành công.
