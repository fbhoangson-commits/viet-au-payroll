# FIX Nhân Sự Master — Thêm / Export / Import Excel

Phạm vi chỉ sửa `src/features/employee-master/Page.jsx`.

## Quy ước Master cố định

Export, Template và Import dùng đúng 22 cột theo file Nhân Sự Master:

1. Mã Nhân Viên
2. Họ và Tên
3. Ngày Sinh
4. Giới Tính
5. CCCD
6. Mã Số Thuế
7. Điện Thoại
8. Email
9. Bộ Phận
10. Chức Danh
11. Phân Loại
12. Trạng Thái Nhân Sự
13. Ngày Vào Làm
14. Ngân Hàng
15. Tên Tài Khoản Ngân Hàng
16. Số Tài Khoản Ngân Hàng
17. Ghi Chú Hồ Sơ
18. Hồ Sơ
19. Nhóm
20. MST / CCCD
21. Tham Gia BHXH
22. Người Phụ Thuộc

## Đã sửa

- Export chỉ xuất 22 cột Master, không xuất `id`, `created_at`, `updated_at`, `custom_fields`, `custom_field_order` hoặc các cột động khác.
- Tiêu đề Export là tiếng Việt đúng theo Master.
- Template không còn file rỗng không có Header; có đủ 22 Header Master và sheet `Hướng Dẫn`.
- Chiều rộng cột Excel tự động theo nội dung, có giới hạn để file dễ đọc.
- Export đọc dữ liệu từ cả cột hệ thống và `custom_fields` theo ánh xạ Master hiện có, không tự tạo thêm cột.
- Form `Thêm Nhân Sự` sử dụng đủ 22 trường Master.
- Import chỉ chấp nhận Header thuộc 22 cột Master; file có cột ngoài Master sẽ báo lỗi trước khi ghi dữ liệu.
- Import ghi đúng trường hệ thống khi có cột tương ứng; các trường Master chưa có cột vật lý trong `employees` được lưu qua `custom_fields` theo đúng tên Header Master, không biến thành cột tùy ý.
- Không thay đổi logic tính lương hoặc các module khác.
