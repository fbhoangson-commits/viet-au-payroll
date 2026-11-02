# Giai đoạn 1 – Tài khoản & phân quyền / Nhật ký hoạt động

## Thành phần thay đổi
- `src/features/user-permissions/Page.jsx` và CSS: danh sách tài khoản, mời tài khoản Kế toán tiền lương, khóa tài khoản.
- `src/features/activity-log/Page.jsx` và CSS: đọc, lọc, xuất CSV nhật ký.
- `supabase/migrations/20261102_system_admin_phase1.sql`: RBAC hai vai trò và bảng nhật ký, seed hai email được duyệt nếu đã tồn tại trong Supabase Auth.
- `supabase/functions/system-admin-users/index.ts`: thao tác Auth Admin chỉ chạy phía Edge Function.

## Tài khoản ban đầu
- `fbhoangson@gmail.com`: SUPER ADMIN (migration gán nếu tài khoản đã tồn tại trong `auth.users`).
- `tckt@thptvietau.edu.vn`: PHÒNG TÀI CHÍNH / PAYROLL_ACCOUNTANT (migration gán nếu đã tồn tại). Nếu chưa tồn tại, sau khi deploy Edge Function, Super Admin dùng nút Mời tài khoản để gửi lời mời và cấp vai trò.

## Triển khai
1. Sao lưu database.
2. Chạy migration `20261102_system_admin_phase1.sql` trong Supabase SQL Editor.
3. Deploy Edge Function `system-admin-users` bằng Supabase CLI; đảm bảo môi trường function có `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (không đưa Service Role Key vào frontend).
4. Deploy frontend Cloudflare Pages.
5. Đăng nhập bằng `fbhoangson@gmail.com`, kiểm tra vai trò Super Admin, sau đó kiểm tra danh sách và mời `tckt@thptvietau.edu.vn` nếu tài khoản chưa tồn tại.
6. Kiểm tra trang Nhật ký hoạt động sau thao tác mời/khóa tài khoản.

## Giới hạn hiện tại cần biết
- Nhật ký giai đoạn này ghi các thao tác quản trị tài khoản được thực hiện qua Edge Function. Chưa tự động ghi mọi thao tác trong tất cả module nghiệp vụ; việc đó cần tích hợp theo từng module hoặc trigger có chọn lọc.
- Phân quyền backend mới được áp dụng cho các API quản trị của giai đoạn này. Không thay đổi hàng loạt RLS hiện hữu của các module lương trong patch này để tránh khóa nhầm nghiệp vụ đang vận hành. Trước khi áp dụng RBAC toàn hệ thống phải có đợt khảo sát và chuyển đổi policy riêng.
- Giao diện hiện hỗ trợ mời và khóa tài khoản; chức năng mở khóa, chỉnh sửa ma trận quyền chi tiết và quản lý phiên đăng nhập là các phần tiếp theo.
- Migration không tự tạo tài khoản hoặc mật khẩu. Email chưa có trong Auth phải được mời qua Edge Function.
