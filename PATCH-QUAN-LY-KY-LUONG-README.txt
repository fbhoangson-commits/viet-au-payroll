VIỆT ÂU PAYROLL — PATCH QUẢN LÝ KỲ LƯƠNG

Nội dung ZIP chỉ gồm các file thay đổi/bổ sung:
- src/features/payroll-periods/Page.jsx
- src/features/payroll-periods/payroll-periods.css
- src/features/payroll-periods/README.md
- supabase/migrations/20261027_payroll_periods_module.sql

Triển khai:
1. Giải nén vào thư mục gốc mã nguồn và giữ nguyên cấu trúc đường dẫn.
2. Rà soát schema Supabase hiện tại rồi chạy migration SQL trên môi trường phù hợp.
3. Cài dependencies theo package.json và chạy npm run build.
4. Kiểm tra tạo kỳ cố định, snapshot nhân sự, tạo kỳ phát sinh, cấu hình cột, import/export Excel và RLS trước khi deploy production.

LƯU Ý KIỂM THỬ:
Trong môi trường tạo bản vá này, npm install không hoàn tất do không truy cập được gói registry, vì vậy npm run build chưa thể chạy thành công/xác nhận. Không tuyên bố build đã pass. Hãy chạy build sau khi dependencies cài đặt đầy đủ.
