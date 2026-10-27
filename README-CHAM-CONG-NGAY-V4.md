# WEBAPP LƯƠNG VIỆT ÂU — Chấm Công Ngày V4

## Phạm vi bản vá
Chỉ thay đổi module `src/features/daily-attendance/` và thêm migration cho cấu hình kiểu chữ của mã công. Không sửa module Quản Lý Kỳ Lương hay các module khác.

## Nội dung
- Chuẩn hóa nút và input trong Chấm Công Ngày: cùng kích thước, trạng thái hover/focus/disabled và màu chủ đạo teal; không còn nút HTML mặc định ở các thao tác module.
- Danh mục mã công hiển thị compact, có preview; cấu hình màu chữ, nhập HEX và bật/tắt chữ đậm.
- Ô chấm công không tô màu nền theo mã công; hiển thị màu chữ và độ đậm đã cấu hình.
- Thêm cột `is_bold` bằng migration idempotent để lưu tùy chọn chữ đậm.
- Đồng bộ công chuẩn tự chia các đợt 400 ô cho đến khi xử lý hết, không dừng ở 1.000 ô và không yêu cầu bấm nút nhiều lần.
- Đồng bộ dựa trên toàn bộ snapshot của kỳ, không bị ảnh hưởng bởi bộ lọc/tìm kiếm trên giao diện.
- Giữ nguyên các ô đã có dữ liệu bằng `ignoreDuplicates: true`; chỉ xử lý kỳ đang chọn; khi batch lỗi, báo tiến độ đã xử lý và tải lại dữ liệu để lần chạy sau có thể tiếp tục an toàn.
- Nhân sự thiếu định mức hoặc có định mức 0 vẫn được coi là nhóm không chấm công theo logic hiện tại; định mức khác 0/26/28 được cảnh báo trước khi đồng bộ.

## File trong ZIP
- `src/features/daily-attendance/Page.jsx`
- `src/features/daily-attendance/daily-attendance.css`
- `supabase/migrations/20261027_daily_attendance_code_text_style_v4.sql`

## Triển khai
1. Sao lưu mã nguồn và database.
2. Áp dụng migration `20261027_daily_attendance_code_text_style_v4.sql` trong Supabase SQL Editor.
3. Thay đúng hai file trong `src/features/daily-attendance/`.
4. Chạy `npm run build` trong repository đầy đủ rồi deploy theo quy trình hiện tại.
5. Kiểm thử trên một kỳ được phép chỉnh sửa: đổi màu chữ/HEX, bật/tắt chữ đậm, tải lại trang để kiểm tra lưu bền vững; đồng bộ tập dữ liệu có hơn 1.000 ô trống; xác nhận ô đã có dữ liệu không bị ghi đè; kiểm tra bộ lọc đang bật nhưng đồng bộ vẫn xử lý toàn bộ kỳ.

## Kiểm tra đã thực hiện trong môi trường tạo bản vá
- TypeScript transpile/parse JSX: không có diagnostics.
- Chưa thể chạy `npm run build` toàn repository vì ZIP nguồn được cung cấp chỉ gồm các file vá, không có `package.json` và toàn bộ ứng dụng.
- Chưa chạy migration trên Supabase thật, chưa kiểm tra dữ liệu production hoặc triển khai Cloudflare Pages.

## Lưu ý
Màu hiện lưu ở cột `color` nay được dùng làm **màu chữ**, không còn là màu nền. Sau triển khai, nên rà lại màu của các mã công cũ để bảo đảm tương phản tốt. Migration chỉ bổ sung `is_bold`, không thay đổi RLS hay quyền truy cập.
