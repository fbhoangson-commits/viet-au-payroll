# Phiếu lương V5 — sửa phân nhóm và số tiết

Chỉ thay đổi `src/features/payslips/Page.jsx`.

- Phân nhóm các cấu phần chấm tiết dựa vào nhóm định mức thực tế `TEACHING`, `TUTORING`, `OTHER`, không dựa nhầm vào chữ trong tên cột. Bốn dòng Chiều/Tối/Thứ 7/Chủ Nhật thuộc Lương Phụ Đạo.
- Lấy số tiết theo `teaching_attendance_records` của đúng `period_id`, nhân sự và `salary_rate_column_id`, cùng nguồn với màn hình Chấm Công Tiết Dạy.
- Hiển thị cấu phần đã cấu hình kể cả khi số tiết bằng 0; số tiền chi tiết được tính từ số tiết và đơn giá đã cấu hình. Không ghi dữ liệu và không thay đổi snapshot lương.
- Điều chỉnh CSS chữ THỰC LĨNH để tránh font ligature/uppercase làm lỗi dấu tiếng Việt.

Chưa xác minh trực tiếp với Supabase production. Cần build và kiểm tra phiếu in của một nhân sự có dữ liệu ở cả 3 nhóm sau khi triển khai.
