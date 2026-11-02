# VA Payroll – Tạo tài khoản bằng mật khẩu tạm và hồ sơ người dùng

## Phạm vi
- Thay chức năng mời email bằng tạo tài khoản Auth qua Edge Function `system-admin-users`.
- Gán vai trò `PAYROLL_ACCOUNTANT`, lưu tên hiển thị và ghi nhật ký.
- Mật khẩu tạm sinh riêng; Auth app metadata đặt `must_change_password=true`.
- Bắt buộc đổi mật khẩu lần đầu; hồ sơ góc phải hiển thị họ tên, email, vai trò và menu Đổi mật khẩu/Đăng xuất.
- CORS bổ sung `x-client-info` và `x-supabase-api-version`.

## Triển khai
1. Cập nhật các file trong ZIP vào đúng đường dẫn trên GitHub.
2. Deploy lại Edge Function `system-admin-users` bằng nội dung `supabase/functions/system-admin-users/index.ts` trong ZIP. Bật Verify JWT như cấu hình hiện hành; Function tự xác thực session và gọi `system_is_admin()`.
3. Deploy Cloudflare Pages. Không cần SQL migration mới.
4. Đăng nhập Super Admin, tạo một tài khoản thử nghiệm, sao chép mật khẩu tạm, đăng nhập bằng tài khoản đó và xác nhận màn hình bắt buộc đổi mật khẩu.
5. Đăng xuất, đăng nhập lại để xác nhận mật khẩu mới hoạt động.

## Lưu ý bảo mật
- Service Role Key chỉ nằm trong môi trường Edge Function, tuyệt đối không đưa vào frontend. Supabase Edge Functions cung cấp `SUPABASE_SERVICE_ROLE_KEY` mặc định.
- Tài khoản tạo mới được `email_confirm=true` và buộc đổi mật khẩu ở lần đăng nhập đầu. Không gửi mật khẩu qua email. Super Admin bàn giao mật khẩu tạm qua kênh nội bộ an toàn.
- Nếu tạo user thành công nhưng gán role/profile/log thất bại, Function cố gắng xóa Auth user vừa tạo để tránh tài khoản mồ côi.
- Đây là bản vá mã nguồn; chưa chạy build hoặc test trên Supabase production trong môi trường hiện tại.

## File thay đổi
- `src/features/user-permissions/Page.jsx`
- `src/main.jsx`
- `src/styles.css`
- `supabase/functions/system-admin-users/index.ts`

Không thay đổi `PayrollCalculationPage.jsx`, schema tính lương, dữ liệu kỳ lương hoặc công thức VA10.
