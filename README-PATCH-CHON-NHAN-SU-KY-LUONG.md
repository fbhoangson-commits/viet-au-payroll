# Bản vá chọn nhân sự trong Quản Lý Kỳ Lương

## Thay đổi
- Khi tạo Kỳ Lương FIXED mới, mặc định chọn toàn bộ nhân sự đang hoạt động có mã nhân viên; người dùng có thể bỏ chọn những người không tính lương trong kỳ.
- Khi chỉnh sửa kỳ FIXED, tải đúng danh sách nhân sự đã chốt trong `payroll_period_employees`, cho phép thêm/bỏ nhân sự.
- Có ô tìm kiếm theo mã nhân viên, họ tên, vị trí và phòng ban.
- Có nút Chọn tất cả / Bỏ chọn tất cả.
- Khi lưu, chỉ thêm/xóa các dòng membership cần thay đổi và cập nhật `employee_count`; không sửa Employee Master, không sao chép chấm công hay kết quả tính lương.
- Kỳ CLOSED không cho thay đổi danh sách nhân sự. Muốn thay đổi, cần chuyển kỳ về OPEN trước; sau đó mở chỉnh sửa lại.

## Tác động nghiệp vụ
Màn hình Tính Lương hiện lấy danh sách nhân sự từ `payroll_period_employees` trước, vì vậy lựa chọn tại đây là danh sách nhân sự đầu vào để tính lương cho kỳ.
Các Run đã tạo/khóa giữ snapshot riêng; thay đổi membership không ghi đè snapshot của Run đã lưu.

## File thay đổi
- `src/features/payroll-periods/Page.jsx`
- `src/features/payroll-periods/payroll-periods.css`

## Kiểm tra
Đã transpile JSX bằng TypeScript: 0 diagnostics.
Chưa chạy `npm run build` vì source working copy không có `node_modules`.
Chưa chạy bất kỳ thao tác ghi dữ liệu nào lên Supabase.
