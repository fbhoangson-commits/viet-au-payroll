# VIỆT ÂU PAYROLL – Compact Dashboard Notes Patch

## Mục tiêu
Thu gọn tiện ích công việc thành một khung **GHI CHÚ CỦA TÔI** ở góc phải phần đầu trang Tổng quan. Dashboard vẫn là trang Tổng quan, không biến thành trang quản lý To Do.

## File thay thế
- `src/features/dashboard/Page.jsx`
- `src/features/dashboard/dashboard.css`

## Những điểm thay đổi
- Giữ tiêu đề và mô tả Tổng quan theo FeaturePage hiện có.
- Giữ khung trạng thái/không gian Dashboard chính ở phần nội dung trung tâm.
- Bỏ thẻ trạng thái làm việc cá nhân và thẻ To Do lớn chiếm toàn bộ chiều ngang.
- Thay bằng widget Ghi chú nhỏ ở góc phải, mặc định chỉ hiện tối đa 3 công việc chưa hoàn thành.
- Có thể thêm ghi chú nhanh, đánh dấu hoàn thành, mở sửa.
- Nút “Xem tất cả ghi chú” mở rộng bộ lọc, sắp xếp, danh sách đầy đủ, sửa/xóa và xem việc đã hoàn thành.
- Giữ nguyên bảng Supabase `payroll_user_tasks`, các thao tác CRUD, RLS và migration đã triển khai trước đó. Không có migration mới trong bản vá này.
- Không thay đổi Sidebar, Router, menu khác hoặc module khác.

## Cách cập nhật
Giải nén và thay đúng hai file theo đường dẫn ở trên, commit GitHub và chờ Cloudflare Pages deploy.

## Kiểm tra
Đã rà soát phạm vi chỉ gồm hai file Dashboard. Chưa chạy được Vite production build trong môi trường đóng gói vì thiếu `node_modules`; lệnh kiểm tra bằng `npx esbuild` cũng hết thời gian chờ. Cần kiểm tra tương tác trên môi trường sau deploy.
