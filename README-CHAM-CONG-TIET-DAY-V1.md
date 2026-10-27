# Chấm Công Tiết Dạy — V1

## File thay đổi
- `src/app/navigation.js`: thêm menu `Dữ Liệu Kỳ Lương → Chấm Công Tiết Dạy`.
- `src/features/teaching-attendance/Page.jsx`: module chọn kỳ, ba nhóm, đọc định mức/đơn giá, sửa số tiết, Import/Export.
- `src/features/teaching-attendance/teaching-attendance.css`: giao diện theo phong cách hiện có.
- `supabase/migrations/20261027_teaching_attendance_module.sql`: bảng lưu số tiết và RLS.

## Data model
- Kỳ: `payroll_periods`, gồm `salary_version_id`.
- Danh sách nhân sự kỳ: `payroll_period_employee_snapshots`.
- Nhóm/cột: `salary_rate_groups`, `salary_rate_columns`.
- Đơn giá: `salary_rate_values.values` JSONB, khóa theo employee/group/policy; key trong JSONB là `salary_rate_columns.id`.
- Số tiết: `teaching_attendance_records`, lưu theo period + employee + salary_rate_column_id.
- Không lưu đơn giá vào bảng chấm tiết.

## Triển khai
1. Sao lưu repository và database trước khi cập nhật.
2. Chạy migration này trong Supabase SQL Editor sau khi đã triển khai migration Định Mức Lương và Chấm Công Ngày.
3. Thay các file trong ZIP vào đúng đường dẫn.
4. Chạy `npm install` nếu môi trường chưa cài dependencies, sau đó `npm run build`.
5. Deploy lên Cloudflare Pages.
6. Kiểm tra với một Kỳ Lương thật: có snapshot nhân sự, `salary_version_id` khớp phiên bản chính sách, và mỗi thành phần có đơn giá trong `salary_rate_values`.

## Lưu ý
- Trang chỉ hiển thị các nhóm có code/tên ánh xạ được `TEACHING`, `TUTORING`, `OTHER`.
- Cột được lấy từ `salary_rate_columns`; giá lấy từ `salary_rate_values.values[column_id]`.
- Nếu thiếu đơn giá, thao tác lưu số tiết của nhân sự đó bị chặn để không tạo tổng tiền giả.
- Import dùng file Excel `.xlsx`/`.xls`; chỉ import số tiết, nhận diện nhân viên bằng Mã Nhân Viên.
- Migration RLS sử dụng `payroll_can_operate()` đã có trong schema hiện tại; cần xác nhận function và quyền thực tế trong Supabase trước khi triển khai production.
