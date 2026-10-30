# Bản vá Module Tổng quan – Công việc cá nhân

## File thay đổi/bổ sung
- `src/main.jsx`: riêng nhóm `TỔNG QUAN` trở thành liên kết trực tiếp đến Dashboard, không xổ xuống. Các nhóm menu khác giữ nguyên cách hoạt động.
- `src/features/dashboard/Page.jsx`: thay trang placeholder bằng Dashboard và quản lý công việc cá nhân qua Supabase.
- `src/features/dashboard/dashboard.css`: kiểu dáng riêng cho Dashboard/To Do, responsive.
- `src/styles.css`: bổ sung trạng thái hover/active cho liên kết Tổng quan.
- `supabase/migrations/202610300001_create_payroll_user_tasks.sql`: tạo bảng, index, RLS và quyền CRUD riêng cho chủ sở hữu.

## Bước triển khai bắt buộc
1. Mở Supabase SQL Editor của đúng project đang dùng cho Webapp.
2. Chạy toàn bộ file `supabase/migrations/202610300001_create_payroll_user_tasks.sql`.
3. Kiểm tra bảng `public.payroll_user_tasks` đã được tạo và RLS đang bật.
4. Thay/cập nhật các file frontend theo đúng đường dẫn trong ZIP lên GitHub, commit và chờ Cloudflare Pages deploy.
5. Đăng nhập bằng tài khoản hiện tại, vào Tổng quan, tạo một công việc thử. Đăng xuất/đăng nhập lại để kiểm tra đồng bộ.
6. Dùng một tài khoản thứ hai (nếu có) để xác nhận không đọc/sửa/xóa được công việc của tài khoản thứ nhất.

## Lưu ý bảo mật và dữ liệu
- Frontend không gửi `user_id` khi tạo; database tự gán `auth.uid()`.
- RLS giới hạn SELECT/INSERT/UPDATE/DELETE theo `user_id = auth.uid()`.
- Không dùng LocalStorage làm nguồn lưu trữ.
- Công việc quá hạn chỉ được cảnh báo; không tự đổi trạng thái.
- Chức năng chưa thể lưu/tải nếu chưa chạy migration SQL.

## Kiểm tra
Đã rà soát luồng auth hiện tại: app chỉ render Dashboard sau khi có Supabase session; client dùng Supabase anon key và phiên đăng nhập hiện hữu. Chưa có quyền truy cập project Supabase thực tế để chạy migration hoặc kiểm tra RLS trên dữ liệu thật.
