# VA-BANK – Phase 1: Hồ sơ tài khoản ngân hàng

## File trong gói
- `src/app/navigation.js`: thêm mục **Tài khoản ngân hàng** trong nhóm NHÂN SỰ.
- `src/features/employee-bank/Page.jsx`: màn hình danh sách, bổ sung/cập nhật và xác minh tài khoản.
- `src/features/employee-bank/employee-bank.css`: giao diện responsive.
- `supabase/migrations/20261102_employee_bank_accounts.sql`: tạo bảng hồ sơ ngân hàng, lịch sử và RLS.

## Triển khai
1. Mở Supabase Dashboard → SQL Editor.
2. Chạy toàn bộ nội dung file `supabase/migrations/20261102_employee_bank_accounts.sql`.
3. Chép các file `src/...` trong ZIP vào đúng đường dẫn repository, giữ nguyên các file khác.
4. Commit/push GitHub để Cloudflare Pages build và deploy.
5. Đăng nhập bằng Super Admin hoặc Kế toán tiền lương, mở **NHÂN SỰ → Tài khoản ngân hàng**.

## Phạm vi đã có
- Danh sách toàn bộ nhân sự; tìm theo mã, họ tên, bộ phận.
- Bổ sung/cập nhật một tài khoản cho mỗi nhân viên.
- MSB được chọn mặc định trong biểu mẫu và ưu tiên hiển thị; không tự gán tài khoản cho nhân viên.
- Hỗ trợ Vietcombank, BIDV, MB, ACB, Techcombank, VIB, VietinBank và ngân hàng khác.
- Lưu số tài khoản, chủ tài khoản, chi nhánh, ghi chú trong bảng riêng `employee_bank_accounts`, không dùng `employees.custom_fields`.
- Super Admin và Kế toán tiền lương được nhập/sửa/xác minh theo RLS.
- Mỗi lần thêm/sửa/xác minh đều có lịch sử cũ/mới trong `employee_bank_account_history`.
- Sửa thông tin tài khoản sẽ tự chuyển về trạng thái chờ xác minh.

## Chưa nằm trong Phase 1
Import Excel, snapshot vào kỳ lương, báo cáo chuyển khoản Excel, mẫu upload MSB/ngân hàng khác và theo dõi lệnh chuyển khoản sẽ triển khai ở các phase tiếp theo. Cần file mẫu upload thực tế của MSB trước khi làm file chuyển khoản tương thích cổng ngân hàng.

## Lưu ý
Đây là migration bổ sung, không sửa bảng hoặc công thức tính lương hiện hữu. Chưa thể kiểm tra kết nối Supabase thực tế của trường từ môi trường đóng gói; cần chạy migration trên dự án Supabase trước khi dùng màn hình.
