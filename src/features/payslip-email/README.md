# Gửi email phiếu lương

## Đã triển khai ở giao diện
- Đọc kỳ lương và phiên bản từ `payroll_periods`, `payroll_runs`.
- Danh sách nhân sự lấy từ `input_snapshot` của đúng Run đang chọn.
- Đối chiếu email theo Employee Master (`employees`) bằng `employee_id`, dự phòng theo mã nhân viên.
- Bộ lọc kỳ, phiên bản, phân loại, phòng ban, email và tìm kiếm.
- Chọn từng người/chọn danh sách đang lọc; xem trước nội dung email; xác nhận trước khi gọi dịch vụ gửi.
- Chặn gửi từ giao diện nếu Run chưa ở trạng thái APPROVED/LOCKED.

## Chưa thể gửi email thật trong bản nguồn này
Mã nguồn chưa có Supabase Edge Function gửi email, nhà cung cấp email, API key/secret hoặc bảng lịch sử gửi. Giao diện gọi tên function dự kiến `send-payslip-email`; nếu function chưa được triển khai, thao tác sẽ báo lỗi rõ ràng và không đánh dấu gửi thành công.

Trước khi hoàn tất gửi thật cần chốt nhà cung cấp email (ví dụ Resend), cấu hình domain gửi và Supabase Secret; xây dựng Edge Function kiểm tra quyền/RLS, tạo PDF theo đúng mẫu in của module Phiếu lương, gửi riêng từng người và ghi lịch sử gửi. Chưa tạo migration hoặc thay đổi schema trong bản này.
