# Patch V1 — Lịch Sử Nhân Sự

## Chỉ các file thuộc phạm vi module
- `src/features/employee-history/Page.jsx`
- `src/features/employee-history/services/employeeHistoryService.js`
- `src/features/employee-history/styles/employee-history.css`
- `src/features/employee-history/README.md`
- `supabase/migrations/20261026_employee_history_module.sql`

## Cài đặt
1. Sao lưu các file hiện tại.
2. Giải nén ZIP tại thư mục gốc repository `viet-au-payroll`, giữ nguyên đường dẫn.
3. Đọc migration SQL trước khi chạy. Chạy trong SQL Editor của đúng Supabase project đang kết nối với Cloudflare Pages.
4. Commit/push các file thay đổi lên GitHub, chờ Cloudflare Pages build/deploy.
5. Mở `/employee-history`, thử tải danh sách, tạo một sự kiện thử có nội dung rõ ràng, tải lại trang và xác nhận dữ liệu vẫn còn. Nếu không muốn giữ sự kiện thử, không có chức năng xóa trong module vì lịch sử được thiết kế append-only; hãy chọn sự kiện phù hợp để kiểm thử hoặc dùng môi trường thử nghiệm.

## Tác động migration
- Chỉ tạo `employee_history_event_types` và `employee_history_events`, cùng index và RLS riêng.
- Không sửa/xóa bảng `employees`, `app_users`, `audit_logs`, hoặc chính sách RLS hiện có.
- Không thêm trigger tự động vào `employees` trong bản này.
- RLS: tài khoản authenticated được đọc danh mục và sự kiện; được INSERT sự kiện chỉ khi `actor_auth_user_id = auth.uid()`. Không cấp UPDATE/DELETE cho client.
- Khóa liên kết kỹ thuật là `employees.id`; `employee_code` được lưu để tra cứu nghiệp vụ. Không đổi khóa ngoại hiện có.

## Kiểm tra
- Đã kiểm tra cú pháp JSX/JavaScript bằng TypeScript transpile: không phát hiện lỗi cú pháp.
- Chưa xác minh schema Supabase production, chưa chạy migration, chưa chạy `npm run build` hoặc kiểm thử end-to-end. Cần xác minh các bước này sau khi triển khai.
