# Bản vá: Quy tắc Hỗ trợ riêng trong kỳ lương

## Phạm vi
Chỉ gồm 2 tệp:
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`
- `supabase/migrations/20261102_employee_support_only_payroll_rows.sql`

## Nghiệp vụ
- Nếu nhân sự đã có trong `payroll_period_employees` tại thời điểm liên kết: `support_only=false`, khoản hỗ trợ cộng vào kỳ lương hiện hành; các cấu phần lương khác giữ nguyên.
- Nếu nhân sự chưa có trong kỳ: tự thêm membership + snapshot với `support_only=true`; dòng lương chỉ nhận khoản Hỗ trợ nhân sự.
- Dòng `support_only=true` không lấy lương cố định, tiết dạy/phụ đạo, khoản cộng/trừ, BHXH, công đoàn hoặc thuế TNCN thông thường từ hồ sơ gốc. Thuế hỗ trợ riêng vẫn lấy từ `tax_amount_snapshot` của khoản hỗ trợ.
- Hiển thị phân loại `Hỗ trợ riêng` trong Tổng Hợp Lương.
- Backfill đánh dấu các dòng được tạo cùng transaction với liên kết hỗ trợ bởi migration trước đó; liên kết hỗ trợ vào nhân sự đã có từ trước không bị đánh dấu hỗ trợ riêng.

## Triển khai
1. Sao lưu/commit mã nguồn hiện tại.
2. Chạy SQL migration trong Supabase SQL Editor.
3. Thay đúng `PayrollCalculationPage.jsx` trên GitHub.
4. Commit và chờ Cloudflare Pages deploy.
5. Kiểm tra VA078 T09/2026: lương cố định = 0; tiết dạy = 0; tiền cộng/trừ = 0; BHXH/công đoàn = 0; Hỗ trợ nhân sự = 5.937.512; Thuế hỗ trợ theo cấu hình khoản; Thực lĩnh = tiền hỗ trợ trừ thuế hỗ trợ.
6. Kiểm tra một nhân sự đã có sẵn trong kỳ và có hỗ trợ: các cấu phần lương cũ không thay đổi, chỉ tăng khoản hỗ trợ.

## Giới hạn kiểm thử
Đã rà soát thay đổi theo mã nguồn ZIP (10) và kiểm tra các nhánh xử lý ở mức mã nguồn. Không chạy được `npm run build` trong môi trường này vì `npm install` bị timeout. Migration chưa được chạy trên Supabase production; cần kiểm tra kết quả sau khi triển khai.
