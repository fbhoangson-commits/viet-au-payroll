# VA – Hỗ trợ riêng trong kỳ lương

Gói gồm:
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`: xuất phát chính xác từ file VA10 người dùng cung cấp; chỉ thêm nhánh support_only.
- `supabase/migrations/20261102_employee_support_only_period_rows.sql`: thêm cờ snapshot và mở rộng RPC liên kết để tạo membership/snapshot khi nhân sự chưa có trong kỳ.

Lưu ý triển khai: chạy SQL migration trước, sau đó thay đúng file JSX. Migration chỉ thêm cột và thay function RPC. Chưa chạy trên Supabase production.
