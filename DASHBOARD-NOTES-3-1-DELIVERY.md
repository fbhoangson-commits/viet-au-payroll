# Dashboard – Ghi chú của tôi (chỉ file thay đổi)

## File
- `src/features/dashboard/Page.jsx`
- `src/features/dashboard/dashboard.css`
- `supabase/migrations/20261102_payroll_user_tasks_color_pin.sql`

## Nội dung
- Bố cục desktop: nội dung Dashboard chiếm khoảng 3/4 chiều ngang; Ghi chú của tôi thành cột riêng khoảng 1/4, cố định theo chiều cao màn hình và cuộn độc lập.
- Màn hình nhỏ: ghi chú trở về luồng nội dung bình thường để không che Dashboard.
- Ghi chú có 6 màu.
- Có thể ghim/bỏ ghim; ghi chú ghim được ưu tiên lên đầu.
- Tick để đánh dấu hoàn thành; thao tác hoàn thành hiện có được giữ nguyên.
- Không thay đổi bảng lương, công thức tính lương, hay các module khác.

## Triển khai
1. Giải nén vào thư mục gốc dự án và ghi đè đúng 2 file frontend.
2. Supabase SQL Editor → New query → chạy toàn bộ file migration `20261102_payroll_user_tasks_color_pin.sql`.
3. Commit/Push GitHub để Cloudflare Pages build.

Không cần Edge Function mới.

## Lưu ý
Migration bổ sung hai cột `color` và `is_pinned` cho `payroll_user_tasks`, có default nên dữ liệu ghi chú hiện tại được giữ nguyên.
