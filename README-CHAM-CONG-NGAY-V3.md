# Bản vá Chấm Công Ngày V3

## Các vấn đề xử lý
- Thêm cấu hình màu cho từng mã công: chọn màu khi thêm mã và đổi màu mã đã có; màu hiển thị trên nhãn mã và ô chấm công.
- Giới hạn thao tác “Đồng bộ công chuẩn” tối đa 1.000 ô trong một lượt. Nếu còn ô trống, thông báo số lượng còn lại để người dùng bấm đồng bộ tiếp. Không ghi đè ô đã có dữ liệu.
- Nhân sự chưa có bản ghi định mức trong `salary_workday_norms` mặc định vào nhóm “Không chấm công ngày”, giống định mức `workday_count = 0`.
- Quản Lý Kỳ Lương: tạo mới vẫn luôn ở `DRAFT`; thêm thao tác riêng “Mở kỳ” cho kỳ nháp và “Đóng kỳ” cho kỳ đang mở. Đây là thao tác trạng thái sau khi tạo, không phải lựa chọn trạng thái trong form.
- Chấm Công Ngày chỉ cho sửa khi kỳ ở `DRAFT` hoặc `OPEN`; kỳ `CLOSED`/`LOCKED` chỉ xem.

## File trong gói
- `src/features/daily-attendance/Page.jsx`
- `src/features/daily-attendance/daily-attendance.css`
- `src/features/payroll-periods/Page.jsx`
- `supabase/migrations/20261027_daily_attendance_group_standards_v3.sql`

## Triển khai
1. Sao lưu mã nguồn và database.
2. Giải nén ở thư mục gốc repository, ghi đè đúng các file trên.
3. Chạy migration V3 trên Supabase sau khi kiểm tra bảng `daily_attendance_codes` tồn tại và thử ở môi trường kiểm thử.
4. Chạy `npm run build`.
5. Kiểm thử trên một kỳ nháp: đổi màu mã công, đồng bộ hơn 1.000 ô (xác nhận mỗi lượt tối đa 1.000), xác nhận nhân sự không có định mức hiện là “Không chấm công ngày”, bấm “Mở kỳ” từ danh sách và xác nhận kỳ mở cho phép nhập.

## Lưu ý
- Đã kiểm tra cú pháp JSX bằng TypeScript transpiler và tạo ZIP. Chưa chạy build toàn repository hoặc SQL migration trên Supabase thật.
- Nếu thao tác “Mở kỳ” bị database từ chối bởi `payroll_periods_status_check`, cần xem các giá trị status hợp lệ trong constraint trước khi sửa schema; không bỏ constraint để né lỗi.
