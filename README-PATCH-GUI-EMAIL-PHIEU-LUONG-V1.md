# VIỆT ÂU PAYROLL — PATCH GỬI EMAIL PHIẾU LƯƠNG V1

## Phạm vi thay đổi
- `src/features/payslips/Page.jsx`: xuất hàm dựng HTML bằng đúng hàm `printHtml()` và `buildPayBreakdown()` đang được màn hình Phiếu lương sử dụng; không thay đổi giao diện hoặc luồng in hiện hữu.
- `src/features/payslip-email/Page.jsx`: lấy đủ dữ liệu để dựng đúng phiếu lương, tạo hàng đợi, gọi bộ xử lý, hiển thị lịch sử email.
- `supabase/functions/enqueue-payslip-emails/index.ts`: xác thực người thao tác, kỳ/run đã duyệt hoặc khóa, đối chiếu Employee Master và Snapshot, lưu HTML phiếu lương riêng tư, chống gửi trùng theo run + nhân sự.
- `supabase/functions/process-payslip-email-queue/index.ts`: lấy hàng đợi, gửi qua Google Apps Script, ghi trạng thái SENT/FAILED.
- `supabase/migrations/20261031_payroll_email_queue.sql`: tạo bảng hàng đợi và chính sách đọc dành cho người có quyền vận hành payroll; bucket private.
- `supabase/apps-script/Code.gs`: mã Web App nhận HTML, chuyển thành PDF và gửi bằng Gmail Workspace.

## Cài đặt
1. Sao lưu source hiện tại. Giải nén patch tại thư mục gốc repository, giữ nguyên cấu trúc thư mục.
2. Mở SQL Editor đúng Supabase project đang được Webapp sử dụng, kiểm tra rồi chạy `supabase/migrations/20261031_payroll_email_queue.sql`.
3. Deploy Edge Functions:
   - `enqueue-payslip-emails`
   - `process-payslip-email-queue`
4. Trong Supabase Edge Function Secrets, cấu hình:
   - `PAYROLL_GAS_WEBAPP_URL`: URL Web App `/exec` vừa deploy của Apps Script.
   - `PAYROLL_GAS_TOKEN`: đúng giá trị `PAYROLL_EMAIL_TOKEN` trong Script Properties của Apps Script. Không đưa token vào source, GitHub hoặc chat.
   - Các secrets Supabase mặc định `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` phải tồn tại.
5. Cập nhật Apps Script bằng `supabase/apps-script/Code.gs`, giữ Script Property `PAYROLL_EMAIL_TOKEN` hiện tại. Deploy > Manage deployments > Edit > New version. Web App vẫn Execute as Me và access Anyone. Không cần tạo token mới nếu token hiện tại đã hoạt động.
6. Deploy frontend và kiểm tra `npm run build`.
7. Thử gửi trước cho một tài khoản nội bộ đã có email trong Employee Master. Chỉ chọn run APPROVED/LOCKED. Xác nhận email có đúng một file PDF, mở PDF kiểm tra số liệu/phụ lục rồi mới gửi theo nhóm.

## Quy trình
Webapp tạo HTML từ cùng mẫu phiếu lương đang dùng → Edge Function xác thực và đưa HTML vào private Storage + queue → worker gọi Apps Script → Apps Script chuyển HTML thành PDF và GmailApp gửi email → queue ghi SENT/FAILED. Mỗi nhân sự nhận email riêng.

## Bảo mật và chống gửi trùng
- PDF/HTML tạm lưu trong private bucket, không có public URL.
- Frontend không nhận service-role key hoặc GAS token.
- Edge Function kiểm tra phiên đăng nhập và `payroll_can_operate()`.
- Chặn gửi nếu run chưa APPROVED/LOCKED; email lấy từ Employee Master.
- Unique `(payroll_run_id, employee_id)` ngăn gửi lại cùng một phiếu lương; cần thao tác quản trị có chủ đích nếu muốn gửi lại.

## Giới hạn kiểm thử trong bản vá
Chưa thể kiểm tra trực tiếp Supabase production, deploy Edge Functions, Script Properties hoặc gửi email thật từ môi trường đóng gói. Phải hoàn tất các bước cấu hình trên và kiểm thử một người nhận trước khi sử dụng hàng loạt. Build frontend cần được chạy trong repository có dependencies.
