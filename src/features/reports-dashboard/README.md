# Báo cáo Dashboard

Dashboard đọc dữ liệu thật từ Supabase, chủ yếu từ `payroll_runs.input_snapshot`, `payroll_periods`, `payroll_approvals` và Employee Master (`employees`).

- Không tạo hoặc sửa dữ liệu lương.
- Không thay đổi trạng thái duyệt.
- Không tính lại công thức lương.
- Chọn riêng một phiên bản lương cho KPI và bảng chi tiết; phần so sánh lịch sử chỉ lấy phiên bản mới nhất của từng kỳ.
- Dữ liệu không có trong snapshot được hiển thị là chưa có dữ liệu hoặc dấu gạch ngang, không giả định bằng 0.
