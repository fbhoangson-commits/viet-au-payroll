# PATCH – Phiên bản Định Mức Lương độc lập

## Phạm vi
Bản vá bổ sung lớp phiên bản định mức theo từng Chính Sách Lương, sao chép dữ liệu theo giao dịch, gắn phiên bản định mức vào Kỳ Lương và chuyển các màn hình liên quan sang đọc đúng phiên bản.

### File mới
- `supabase/migrations/20261030_salary_rate_versions.sql`

### File cập nhật
- `src/features/salary-rates/Page.jsx`
- `src/features/salary-rates/salary-rates.css`
- `src/features/payroll-periods/Page.jsx`
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`
- `src/features/teaching-attendance/Page.jsx`
- `src/features/insurance-tax-data/Page.jsx`
- `src/features/workday-norms/Page.jsx`
- `src/features/payslips/Page.jsx`
- `src/features/payslip-email/Page.jsx`

## Nghiệp vụ được bổ sung
1. Tạo phiên bản định mức mới từ phiên bản đang chọn bằng RPC `clone_salary_rate_version`; việc tạo phiên bản và sao chép toàn bộ giá trị thực hiện trong cùng một transaction.
2. Mỗi phiên bản lưu `groups_snapshot`, `columns_snapshot` và các giá trị nhân sự riêng.
3. Import và sửa định mức ghi vào `salary_rate_version_values`, không ghi ngược vào `salary_rate_values`.
4. Khi tạo Kỳ Lương, người dùng phải chọn Phiên Bản Định Mức thuộc đúng Chính Sách Lương.
5. Tính Lương, Chấm Công Tiết Dạy, dữ liệu BHXH/thuế, Định Mức Ngày Công và Phiếu Lương đọc bộ định mức được kỳ lương tham chiếu.
6. Phiên bản được kỳ lương `CLOSED` hoặc `LOCKED` sử dụng không thể sửa/xóa giá trị; kỳ đã khóa không thể đổi chính sách hoặc phiên bản định mức.
7. Báo cáo định mức có lựa chọn cột, áp dụng bộ lọc nhân sự đang hiển thị và mở hộp thoại in A4 ngang để người dùng lưu PDF.

## Cách triển khai
1. Sao lưu Supabase trước khi thay đổi schema.
2. Chạy duy nhất migration `supabase/migrations/20261030_salary_rate_versions.sql` trong Supabase SQL Editor.
3. Kiểm tra migration hoàn tất, các kỳ lương cũ đã có `salary_rate_version_id` tương ứng và các dòng trong `salary_rate_version_values` đã được sao chép.
4. Deploy mã nguồn trong patch ZIP.
5. Mở Định Mức Lương, kiểm tra phiên bản khởi tạo của từng Chính Sách Lương; tạo thử một phiên bản mới và đối chiếu số nhân sự/giá trị trước khi sử dụng cho kỳ lương mới.

## Kiểm tra đã thực hiện
- Đã kiểm tra cú pháp JSX/JavaScript bằng TypeScript `transpileModule` cho toàn bộ 8 file JSX cập nhật: **8/8 PASS**.
- Chưa chạy được `npm run build`: quá trình cài dependencies (`npm install --ignore-scripts --no-audit --no-fund`) bị timeout trong môi trường hiện tại.
- Chưa chạy migration trên Supabase và chưa kiểm tra dữ liệu production. Không có thao tác nào được thực hiện trên Supabase thật.

## Lưu ý
- Migration là additive: giữ nguyên `salary_rate_values` và dữ liệu cũ; dữ liệu cũ được sao chép sang các phiên bản định mức khởi tạo.
- Không deploy hoặc chạy migration trước khi có backup và kiểm tra môi trường Supabase đích.
- Báo cáo PDF sử dụng hộp thoại in của trình duyệt; chọn **Save as PDF** để lưu tệp.
