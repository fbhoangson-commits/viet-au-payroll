# Bản vá Module Hỗ Trợ Nhân Sự – VIỆT ÂU PAYROLL

## Phạm vi thay đổi
1. `src/features/employee-support/Page.jsx`
   - Thay trang placeholder bằng module CRUD hỗ trợ nhân sự.
   - Hỗ trợ nhân sự hiện tại, đã nghỉ việc, thực tập, học việc và đối tượng khác.
   - Chọn liên kết Employee Master tùy trường hợp; không tạo/sửa hồ sơ nhân sự.
   - Quy trình Nháp → Chờ duyệt → Đã duyệt → Đã đưa vào kỳ lương → Đã thanh toán; có trạng thái Hủy.
   - Bộ lọc theo người nhận, loại đối tượng, trạng thái, kỳ hỗ trợ, trạng thái liên kết và ngày tạo.
   - Import Excel có sheet hướng dẫn, xem trước, kiểm tra lỗi và phát hiện trùng; Export Excel.
   - Chọn nhiều khoản đã duyệt để đưa vào Kỳ Lương.
   - Tùy chỉnh ngưỡng và tỷ lệ thuế khấu trừ; lưu cấu hình theo từng khoản tại thời điểm tạo.
   - Tải tài liệu lên private storage bucket và mở bằng signed URL.
2. `src/features/employee-support/employee-support.css`
   - Giao diện riêng theo phong cách VIỆT ÂU PAYROLL.
3. `supabase/migrations/20261030_employee_support_module.sql`
   - Tạo các bảng độc lập: `employee_support_items`, `employee_support_period_links`, `employee_support_audit_logs`, `employee_support_tax_settings`.
   - Tạo private storage bucket `employee-support-attachments`.
   - RLS dựa trên `public.payroll_can_operate()`.
   - Unique constraint một khoản hỗ trợ chỉ liên kết được một kỳ.
   - RPC `employee_support_link_to_period` khóa dòng và liên kết theo transaction, ngăn đưa trùng.
   - Bảo vệ khoản hỗ trợ đã gắn vào kỳ khóa; không cho xóa vật lý.
4. `src/features/payroll-calculation/PayrollCalculationPage.jsx`
   - Đọc các khoản hỗ trợ đã liên kết theo Kỳ Lương.
   - Cộng khoản hỗ trợ thành cấu phần riêng `employeeSupport`, không nhập vào Khoản Cộng hiện hữu.
   - Khấu trừ `supportTax` riêng; loại khoản hỗ trợ này khỏi căn cứ tính thuế thông thường để tránh tính trùng theo cấu hình nghiệp vụ.
   - Lưu `employee_support` và `support_tax` vào snapshot payroll run.
5. `src/features/payslips/Page.jsx`
   - Hiển thị Hỗ trợ Nhân sự ở phần thu nhập và Thuế TNCN khấu trừ khoản hỗ trợ ở phần khấu trừ.

## Cách triển khai
1. Sao lưu mã nguồn và Supabase.
2. Giải nén ZIP tại thư mục gốc dự án, giữ nguyên đường dẫn.
3. Chạy migration `supabase/migrations/20261030_employee_support_module.sql` trên Supabase.
4. Kiểm tra RLS, bucket storage và RPC đã được tạo.
5. Chạy `npm run build`.
6. Deploy, mở `/employee-support`, tạo thử một khoản hỗ trợ test, duyệt, liên kết với kỳ DRAFT/OPEN, kiểm tra màn hình Tính Lương và Phiếu Lương.

## Các nguyên tắc bảo toàn
- Không sửa Employee Master.
- Không thay đổi `payroll_adjustments`.
- Không thay đổi công thức định mức, chấm công, BHXH.
- Khoản hỗ trợ được lưu trong bảng riêng; chỉ snapshot khoản có `employee_id` mới được cộng vào dòng lương nhân sự.
- Người nhận ngoài Employee Master vẫn quản lý, lọc, import/export và liên kết kỳ để đối chiếu chi trả riêng; không tạo hồ sơ nhân sự giả.
- Không tự chạy migration hoặc ghi dữ liệu thật.

## Kiểm tra trong môi trường thực hiện
- Đã kiểm tra cú pháp JSX bằng TypeScript transpile cho toàn bộ 41 file JSX trong source: không có lỗi cú pháp.
- Chưa chạy được `npm run build`: thư mục không có `node_modules`; `npm install --offline` thất bại do package cache không có dependency. Cần chạy build trong môi trường có thể cài dependencies.
- Chưa chạy migration trên Supabase; chưa xác minh quyền/RLS và hành vi production.
- File đính kèm hỗ trợ các định dạng PDF, JPG, PNG, DOCX, giới hạn 10 MB.
