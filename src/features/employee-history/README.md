# Lịch sử nhân sự

Module độc lập để ghi nhận và tra cứu sự kiện nhân sự thực tế từ Supabase.

## Files
- `Page.jsx`: giao diện danh sách, bộ lọc, tạo sự kiện và xem chi tiết.
- `services/employeeHistoryService.js`: truy vấn Supabase và xác minh nhân sự theo `employee_code`.
- `styles/employee-history.css`: CSS riêng của module.

## Migration
Chạy `supabase/migrations/20261026_employee_history_module.sql` trong SQL Editor của đúng Supabase project trước khi sử dụng. Migration chỉ thêm hai bảng sự kiện/danh mục, index và RLS riêng; không sửa/xóa bảng hiện có, không thay đổi auth hay RLS của module khác. Bảng sự kiện dùng UUID `employees.id` làm FK và lưu `employee_code` để đối chiếu nghiệp vụ. Chỉ cho phép SELECT/INSERT qua client; không cấp UPDATE/DELETE policy cho lịch sử.

## Giới hạn phiên bản đầu
- Sự kiện được tạo thủ công; module này chưa tự động ghi mọi thay đổi từ Nhân Sự Master. Không tạo lịch sử quá khứ giả. Cơ chế trigger/audit tự động cần được thiết kế riêng sau khi kiểm tra schema thật và được duyệt.
- Bộ lọc và thống kê hoạt động trên dữ liệu sự kiện đã đọc theo quyền RLS.
- Tệp đính kèm và quy trình phê duyệt chưa được triển khai.
