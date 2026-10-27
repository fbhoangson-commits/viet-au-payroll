# Bản vá Chấm Công Ngày V2

## Phạm vi
- Công chuẩn gốc của từng nhân sự lấy từ `salary_workday_norms` theo `salary_version_id` của Kỳ Lương. Định mức 0 là nhóm Không tính công; Định Mức Ngày Công cho phép nhập 0 để thể hiện rõ nhóm này.
- Nhận diện nhóm 26 ngày, 28 ngày hoặc không tính công (định mức bằng 0). Giá trị định mức khác 26/28/0 được hiển thị là thiếu định mức, không tự phân loại.
- Cấu hình công chuẩn thực tế theo kỳ: nhóm 26 ngày và nhóm 28 ngày. Nhóm không tính công không dùng mẫu số để đánh giá.
- Nút Đồng bộ công chuẩn dùng mã Có mặt cho thứ Hai–thứ Bảy, mã Nghỉ CN cho Chủ nhật. Kế toán phải chọn rõ hai mã công. Chỉ điền ô trống; không ghi đè ô đã có dữ liệu.
- Quản Lý Kỳ Lương không còn cho thay đổi trạng thái trong biểu mẫu hoặc bấm Mở kỳ. Khi chỉnh sửa, trạng thái hiện tại được giữ nguyên; kỳ mới vẫn được tạo ở trạng thái `DRAFT`.

## File
- `src/features/daily-attendance/Page.jsx`
- `src/features/daily-attendance/daily-attendance.css`
- `src/features/workday-norms/Page.jsx`
- `src/features/payroll-periods/Page.jsx`
- `supabase/migrations/20261027_daily_attendance_group_standards_v2.sql`

## Triển khai
1. Sao lưu repository và database.
2. Ghi đè đúng các file trên.
3. Chạy migration V2 trong Supabase SQL Editor.
4. Chạy `npm run build`.
5. Kiểm thử trên một kỳ nháp trước khi import dữ liệu hàng loạt.

## Lưu ý
- Migration thêm hai cột vào `daily_attendance_month_settings` và đổi ràng buộc `workday_count` để cho phép giá trị 0; không sửa RLS hoặc xóa dữ liệu.
- Cần có bản ghi `salary_workday_norms` cho nhân sự theo chính sách đang gắn với kỳ; nếu không, dòng hiển thị `Thiếu định mức` và nút đồng bộ sẽ dừng để tránh phân loại sai.
- Mã công Có mặt và Nghỉ Chủ nhật phải được cấu hình trong danh mục mã công. Nút đồng bộ không tự suy đoán mã.
