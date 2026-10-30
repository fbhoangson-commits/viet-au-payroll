# Bản vá V2 – Gửi email phiếu lương

## Phạm vi
- Chỉ thay đổi `src/features/payslip-email/Page.jsx`.
- Sửa truy vấn Employee Master: dùng `select('*')` thay cho danh sách cột cố định có `name`.
- Nguyên nhân lỗi trên giao diện: schema `public.employees` hiện tại không có cột `name`, khiến toàn bộ truy vấn Employee Master thất bại.
- Giữ nguyên logic đối chiếu email, Snapshot, kỳ lương, phiên bản Run và các bộ lọc của V1.

## Cài đặt
Giải nén ZIP vào thư mục gốc dự án, ghi đè đúng file theo đường dẫn bên trên, sau đó build và deploy.

## Giới hạn kiểm thử
Bản vá xử lý lỗi truy vấn cột không tồn tại được thể hiện trên ảnh. Chưa xác nhận build toàn dự án hoặc truy vấn trên Supabase production.
