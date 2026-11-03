# VA Dashboard – Ghi chú của tôi

## File thay đổi
- `src/features/dashboard/Page.jsx`
- `src/features/dashboard/dashboard.css`

## Nội dung
- Hiển thị tiêu đề riêng ở trên, nội dung chi tiết ở dưới.
- Nội dung tự xuống dòng, giữ xuống dòng do người dùng nhập (`white-space: pre-wrap`).
- Thẻ tự tăng chiều cao theo nội dung, không cắt tiêu đề/chi tiết.
- Màu chữ được phối theo màu nền cho 6 màu ghi chú: xanh dương, vàng, xanh lá, hồng, tím, xám.
- Giữ nguyên thêm/sửa/ghim/hoàn thành và lưu dữ liệu hiện có.

## Cập nhật
Giải nén và chép đúng 2 file vào repository, commit/push để Cloudflare Pages deploy.
Không có thay đổi SQL hoặc schema.

## Kiểm tra
Đã đối chiếu block ghi chú và CSS với ZIP16; patch chỉ thay đổi phần hiển thị thẻ ghi chú. Chưa chạy build trong môi trường này.
