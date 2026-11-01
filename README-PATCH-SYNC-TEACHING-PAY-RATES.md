# Bản vá đồng bộ đơn giá Tiết dạy / Phụ đạo / Khác sang Tính Lương

## Nguyên nhân
Trong `src/features/payroll-calculation/PayrollCalculationPage.jsx`, phần tải dữ liệu đã xác định `policyRateValues`:
- Nếu Kỳ Lương có `salary_rate_version_id`, dữ liệu đúng phải lấy từ `salary_rate_version_values` theo phiên bản đó.
- Nếu kỳ chưa gắn phiên bản định mức, mới sử dụng `salary_rate_values` theo chính sách lương.

Tuy nhiên, vòng lặp tính tiền tiết dạy vẫn truy vấn trực tiếp `rateValues` (bảng cũ) để tìm đơn giá từng cột. Vì thế thay đổi đơn giá ở phiên bản định mức đang dùng trong Chấm Công Tiết Dạy không được phản ánh đúng ở Tính Lương.

## Sửa đổi
- Dùng `policyRateValues` làm nguồn tìm đơn giá trong vòng lặp tính tiền của các dòng `teaching_attendance_records`.
- Dùng cùng nguồn này cho phần fallback khi tìm giá trị theo cột.
- `policyRateValues` đã được chọn theo `salary_rate_version_id` của kỳ; do đó Tính Lương và Chấm Công Tiết Dạy cùng tham chiếu dữ liệu định mức của phiên bản gắn với kỳ.
- Không sửa số tiết, dữ liệu chấm công, công thức tính lương cố định, khoản cộng/trừ, thuế, BHXH hay phiếu lương.

## File thay đổi
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Cách áp dụng và kiểm tra
1. Thay file theo đúng đường dẫn trong source.
2. Build và deploy.
3. Mở kỳ T09/2026 trong Chấm Công Tiết Dạy và Tính Lương.
4. Đối chiếu một nhân sự có đơn giá vừa thay đổi: số tiết giữ nguyên, thành tiền từng cột và tổng tiền phải khớp với Chấm Công Tiết Dạy.
5. Đối chiếu tổng toàn bộ nhân sự.

## Kiểm tra trong môi trường tạo bản vá
- TypeScript transpile JSX: 0 diagnostics.
- Không có `node_modules` trong source ZIP nên chưa chạy `npm run build`.
- Không kết nối hoặc ghi dữ liệu Supabase.
- Đây là bản vá mã nguồn; chưa deploy production.
