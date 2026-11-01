# PATCH – Đảm bảo Tính Lương tải lại khi dữ liệu nguồn thay đổi

## Phạm vi
Chỉ thay đổi:
`src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Lý do
Trong mã nguồn gốc, `refreshLatest()` bỏ qua sự kiện Realtime và lần polling nếu một lần `load(true)` khác đang chạy (`autoRefreshBusyRef.current === true`). Sự kiện thay đổi bị bỏ qua; không có cơ chế xếp hàng để tải lại sau khi lần tải hiện tại kết thúc.

## Thay đổi
- Giữ nguyên danh sách bảng Supabase đang theo dõi.
- Giữ nguyên chu kỳ polling 15 giây.
- Không thay đổi công thức, dữ liệu, schema, giao diện hoặc nghiệp vụ tính lương.
- Nếu sự kiện thay đổi đến trong lúc đang tải dữ liệu, đánh dấu `refreshPending`.
- Sau khi lần tải hiện tại kết thúc, tự chạy thêm một lần tải để lấy dữ liệu mới nhất.

## Triển khai
Thay đúng file theo đường dẫn trên trong mã nguồn hiện tại, commit/push và deploy theo quy trình hiện tại.

## Giới hạn kiểm chứng
Bản vá xử lý trường hợp sự kiện refresh bị bỏ qua khi đang có tải dữ liệu. ZIP không thể xác nhận bảng `payroll_period_insurance_tax_data` đã được bật trong Supabase Realtime publication hoặc quyền truy cập dữ liệu thực tế trên Supabase. Nếu Realtime chưa bật, polling 15 giây vẫn là cơ chế dự phòng.
Chưa chạy production build vì ZIP không kèm `node_modules`.
