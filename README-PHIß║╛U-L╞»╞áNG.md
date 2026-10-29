# Bản vá module Phiếu lương

## File thay đổi
- `src/features/payslips/Page.jsx`

## Phạm vi
- Thay khung trống của Phiếu lương bằng màn hình tra cứu theo kỳ/phiên bản, lọc nhân sự, bảng tổng hợp và xem trước phiếu lương.
- Đọc số tiền từ `payroll_runs.input_snapshot.results` của đúng phiên bản; không tính lại và không ghi dữ liệu lương.
- Đọc lịch sử duyệt từ `payroll_approvals` và chi tiết khoản cộng/trừ từ `payroll_adjustments` nếu truy vấn được.
- Chỉ bật thao tác In/Lưu PDF cho phiên bản `APPROVED` hoặc `LOCKED`. Thao tác dùng hộp thoại in của trình duyệt; người dùng chọn “Save as PDF / Lưu dưới dạng PDF”.
- Không thêm migration hoặc bảng mới.

## Giới hạn kiểm thử
- Đã chạy kiểm tra cú pháp JSX bằng TypeScript compiler (`tsc --allowJs --checkJs false --jsx react-jsx --noEmit --noResolve --target ES2022 --module ESNext`) thành công.
- Chưa chạy `npm run build`: `npm install` bị timeout trong môi trường thực thi.
- Chưa thể kiểm thử kết nối Supabase thật hoặc xác minh RLS/schema trên môi trường triển khai.
