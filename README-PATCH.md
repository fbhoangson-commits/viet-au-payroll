# V17 — Nhân Sự Master Excel order/display patch

Chỉ thay đổi `src/features/employee-master/Page.jsx`.

Sửa:
- Giữ thứ tự Header đúng theo file Excel, kể cả cột toàn ô trống.
- Không tự hiển thị thêm các cột vật lý không có trong file Excel khi đã có Header order.
- Bổ sung nhãn tiếng Việt cho các trường thường gặp.
- Các trường không có ánh xạ vật lý (MST / CCCD, Phân loại, Nhóm, Tham gia BHXH, Người phụ thuộc) được lưu trong custom_fields theo Header Excel.
- Ô trống không ghi đè giá trị đã có.

Cập nhật bằng cách chép đè file Page.jsx lên đúng đường dẫn trong repository, commit/push và chờ Cloudflare build. Không cần SQL mới nếu migration custom_fields/custom_field_order của V15 đã chạy thành công.

Chưa kiểm thử trực tiếp với Supabase production; xác minh sau deploy bằng một bản import thử đã sao lưu.
