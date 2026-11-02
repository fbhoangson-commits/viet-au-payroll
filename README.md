# Bản vá: Xóa vĩnh viễn khoản Hỗ trợ nhân sự

## Phạm vi
- Chỉ thay `src/features/employee-support/Page.jsx` để thêm nút Xóa ở từng dòng và hộp thoại xác nhận.
- Thêm migration `supabase/migrations/20261102_employee_support_permanent_delete.sql` tạo RPC xóa an toàn.
- Không sửa `PayrollCalculationPage.jsx`, công thức TNCN VA10, schema nhân sự kỳ lương hoặc Employee Master.

## Hành vi
- Xóa bản ghi `employee_support_items` trên Supabase.
- Xóa tất cả `employee_support_period_links` gắn với khoản hỗ trợ, kể cả khoản đã thanh toán hoặc kỳ đã khóa.
- Xóa audit logs thuộc riêng khoản hỗ trợ vì FK đang tham chiếu trực tiếp bản ghi bị xóa.
- Xóa tệp đính kèm trong Storage sau khi RPC thành công (nếu Storage lỗi, giao diện thông báo riêng; dữ liệu DB đã xóa).
- Không xóa hồ sơ nhân sự, dòng lương thường, snapshot hoặc các khoản lương khác.
- Sau khi xóa, module tính lương sẽ không còn đọc được khoản hỗ trợ đã bị gỡ liên kết.

## Triển khai
1. Sao lưu database và mã nguồn hiện tại.
2. Chạy migration SQL trong Supabase SQL Editor.
3. Thay đúng `src/features/employee-support/Page.jsx` bằng file trong ZIP.
4. Commit và deploy.
5. Kiểm tra một khoản đã thanh toán: xác nhận khoản hỗ trợ biến mất khỏi Hỗ trợ nhân sự và cột Hỗ trợ nhân sự trong kỳ lương được tính lại; các khoản lương khác vẫn nguyên.

## Lưu ý
Đây là xóa vĩnh viễn, không thể hoàn tác từ giao diện. Chỉ tài khoản có `payroll_can_operate()` mới gọi được RPC. Chưa chạy migration trên production và chưa build toàn ứng dụng trong môi trường này.
