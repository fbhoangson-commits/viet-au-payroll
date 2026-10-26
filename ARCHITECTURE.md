# Kiến trúc module-first

## Quy tắc
1. Mỗi trang nghiệp vụ nằm trong `src/features/<slug>/`.
2. Không import trực tiếp service nội bộ của feature khác; nếu cần dùng chung, chuyển phần tổng quát vào `src/shared/`.
3. Mọi truy vấn dữ liệu phải nằm trong `services/` của feature hoặc service dùng chung được duyệt.
4. Không nhúng dữ liệu nhân sự/lương thật vào mã nguồn.
5. Không tạo seed hoặc tự động import dữ liệu khi ứng dụng khởi động.
6. Thay đổi schema/backend cần được tách riêng, ghi rõ và kiểm tra trước khi áp dụng.
7. Không tự động xóa dữ liệu Supabase khi deploy frontend.
