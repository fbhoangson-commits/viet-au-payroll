# VIỆT ÂU PAYROLL — Phiếu lương V3

## Phạm vi thay đổi
- `viet-au-payroll-main/src/features/payslips/Page.jsx`

## Nội dung
- Loại bỏ dòng sai `Cấu phần tiết dạy (count)` vốn lấy nhầm trường đếm tiết.
- Phiếu in thể hiện riêng tổng lương cố định và 4 cấu phần định mức tìm được theo nhóm Cố định.
- Chi tiết tiền tiết dạy được chia theo nhóm Tiết dạy, Phụ đạo, Dạy khác; từng dòng có số tiết, đơn giá, thành tiền và tổng nhóm khi đủ dữ liệu.
- Tổng lương cố định, tổng tiết dạy/phụ đạo, tổng thu nhập và thực lĩnh vẫn lấy từ snapshot của phiên bản lương đã lưu; chi tiết lấy từ `salary_rate_groups`, `salary_rate_columns`, `salary_rate_values`, `teaching_attendance_records` của kỳ tương ứng.
- Sửa font phần THỰC LĨNH bằng font hệ thống phổ biến và bỏ các thuộc tính chữ có thể làm méo kiểu chữ.
- Bổ sung chi tiết tương tự trong cửa sổ xem trước.

## Giới hạn cần lưu ý
Schema hiện tại không lưu snapshot chi tiết từng cấu phần lương/đơn giá cùng với `payroll_runs`. Vì vậy, các dòng chi tiết được dựng từ dữ liệu định mức và chấm tiết đang có, còn tổng tiền chính thức vẫn là số trong snapshot. Nếu định mức đã bị thay đổi sau lần chốt lương, chi tiết có thể không khớp tổng snapshot; không có dữ liệu lịch sử chi tiết để khẳng định tuyệt đối nếu không mở rộng schema và lưu cấu phần vào snapshot ở lần tính lương sau. Bản vá không thay đổi schema, không ghi dữ liệu và không tính lại snapshot.

## Kiểm tra
- TypeScript parser: không có lỗi cú pháp JSX.
- Chưa chạy build toàn dự án hoặc truy vấn Supabase thật trong môi trường này.
