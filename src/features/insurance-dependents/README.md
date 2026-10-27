# Module Bảo Hiểm và Người Phụ Thuộc

- `Page.jsx`: giao diện bốn tab, tìm kiếm/lọc, CRUD cấu hình, template/import/export Excel, xem trước lỗi import, hồ sơ người phụ thuộc và cấu hình giảm trừ.
- `services/insuranceDependentsService.js`: truy vấn Supabase; không dùng localStorage làm nguồn dữ liệu nghiệp vụ.
- `styles/insurance-dependents.css`: CSS riêng của module.
- Migration bổ sung: `supabase/migrations/20261027_insurance_dependents_module.sql`.

Lưu ý:
- Cần chạy migration trên Supabase sau khi rà soát schema/RLS của môi trường đích. Migration tạo bảng riêng, không sửa bảng employees.
- Tỷ lệ BHXH/BHYT/BHTN và Công Đoàn không tự đặt mặc định; tiền đóng chỉ hiển thị khi đủ mức lương căn cứ và cấu hình tỷ lệ.
- Mức giảm trừ ban đầu là 15.500.000 và 6.200.000 theo yêu cầu hiện tại, có thể sửa trong tab Giảm Trừ Gia Cảnh.
- Import nhận diện bằng Mã Nhân Viên, có xem trước và không xóa dữ liệu chỉ vì ô trống. Tab Giảm Trừ Gia Cảnh quản lý hồ sơ chi tiết ở modal; import số lượng tổng không tự sinh danh tính người phụ thuộc.
- Bản patch chưa được xác nhận build thành công trong môi trường này do không tải được dependencies npm; cần chạy `npm install` và `npm run build` trước khi triển khai production.
- Liên kết Master: cột `Tham gia BHXH` đọc ưu tiên từ trường `social_insurance` hoặc trường động có nhãn `Tham gia BHXH`/`BHXH`; cột `Số người phụ thuộc` đọc ưu tiên từ `dependents_count`/`dependent_count` hoặc trường động có nhãn `Người phụ thuộc`/`Số người phụ thuộc`. Trường động có thể nằm trong `custom_fields` hoặc được bung ra từ JSONB. Nếu Master có giá trị hợp lệ, Master là nguồn ưu tiên; nếu chưa có thì mới dùng dữ liệu hồ sơ của module làm phương án dự phòng. Không ghi ngược dữ liệu sang Nhân Sự Master.


## Mức Hỗ Trợ
- Tab `Mức Hỗ Trợ` có sẵn các cột Ăn trưa, Điện thoại, Đồng phục và Tổng hỗ trợ.
- Có thể thêm, đổi tên, sắp xếp hoặc ngừng hiển thị cột; tổng chỉ cộng các cột đang hoạt động. Dữ liệu cột không bị xóa khi ngừng hiển thị.
- Import ghép theo Mã Nhân Viên và tên cột đã cấu hình; ô trống không ghi đè khoản đang có. Export và template lấy theo cấu hình cột hiện hành.
- Cần chạy migration `supabase/migrations/20261027_support_allowances.sql` trên Supabase trước khi dùng tab mới.
