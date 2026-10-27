# Bàn giao module Chấm công ngày V1

## File trong gói
- `src/features/daily-attendance/Page.jsx`: trang nghiệp vụ chấm công, chọn kỳ, cấu hình công chuẩn, quản lý mã công, nhập liệu theo ngày, tổng hợp và import/export Excel.
- `src/features/daily-attendance/daily-attendance.css`: giao diện riêng, tương thích phong cách hiện tại.
- `supabase/migrations/20261027_daily_attendance_module.sql`: migration tạo bảng bổ sung và RLS policy cho module.

## Cách áp dụng
1. Sao lưu repository và database.
2. Giải nén tại thư mục gốc repository, ghi đè đúng file `Page.jsx`, thêm CSS và migration.
3. Kiểm tra migration trên môi trường kiểm thử trước khi chạy production. Migration giả định đã tồn tại `public.payroll_periods`, `public.employees`, `public.app_users`, `public.payroll_can_operate()` và `public.payroll_is_super_admin()`.
4. Chạy migration SQL trong Supabase SQL Editor.
5. Chạy `npm run build`, sau đó deploy.
6. Mở Chấm công ngày, chọn kỳ. Nếu kỳ cũ chưa có snapshot nhân sự, đối chiếu danh sách rồi dùng nút **Chốt danh sách nhân sự cho kỳ**. Đây là thao tác có xác nhận, lấy dữ liệu Employee Master tại thời điểm bấm; không thể khôi phục danh sách lịch sử trước đó.
7. Thêm danh mục mã công. Chỉ nhập hệ số công sau khi nhà trường xác nhận quy tắc quy đổi.
8. Cấu hình công chuẩn và nhập chấm công.

## Lưu ý an toàn / giới hạn V1
- Module không tự điền nhân sự cho các kỳ cũ; snapshot phải được chốt có xác nhận.
- Kỳ được coi là khóa khi `payroll_periods.status = 'LOCKED'`; các trạng thái khác được kiểm tra theo policy đang có.
- Phạm vi ngày dựa trên `period_year` và `period_month` vì schema kỳ lương hiện được biết có hai cột này. Nếu database thực tế có ngày bắt đầu/kết thúc riêng, cần nối theo schema thực tế.
- Công thực tế chỉ cộng `work_units` của các mã công đã cấu hình. Mã công có hệ số trống sẽ được đánh dấu chưa đủ dữ liệu để kết luận đủ/thiếu công.
- Migration chưa được chạy trên Supabase thật. Chưa xác nhận RLS thực tế của project hay build cho đến khi chạy ở môi trường của Sơn.
