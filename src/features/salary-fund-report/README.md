# Báo cáo quỹ lương

Module đọc dữ liệu từ `payroll_periods`, `payroll_runs`, `payroll_approvals` và `employees` hiện có. Chỉ đọc dữ liệu snapshot; không ghi, tính lại hoặc thay đổi trạng thái lương.

- Chọn kỳ và phiên bản để xem báo cáo chi tiết.
- Khoảng kỳ so sánh ưu tiên phiên bản `APPROVED`/`LOCKED`; nếu không có, dùng phiên bản mới nhất và hiển thị cảnh báo.
- Tất cả truy vấn lớn được phân trang theo lô 1.000 dòng.
- Không có migration/schema mới trong bản vá.
