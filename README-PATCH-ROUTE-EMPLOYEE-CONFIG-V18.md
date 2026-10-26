# VIỆT ÂU PAYROLL — Patch V18

## File có thay đổi
- `src/main.jsx`: khởi tạo route từ `window.location.pathname`, đồng bộ Back/Forward và giữ trang hiện tại khi Reload.
- `src/features/employee-master/Page.jsx`: thêm Cấu hình giao diện; cột hiển thị trên bảng theo thứ tự cấu hình, các trường còn lại vẫn nằm trong Hồ sơ chi tiết; import cập nhật cấu hình cột theo thứ tự Header Excel; trường động được giữ trong `custom_fields`; Dropdown dùng danh mục lấy từ Excel và cho phép thêm lựa chọn.
- `src/features/employee-master/services/employeeService.js`: đọc/lưu cấu hình cột qua Supabase.
- `src/features/employee-master/styles/employee-master.css`: giao diện cấu hình cột.
- `supabase/migrations/20261026_employee_master_column_configs.sql`: tạo bảng cấu hình cột dùng chung và RLS cho authenticated.

## Trước khi triển khai
1. Sao lưu repository hiện tại.
2. Chạy migration SQL trong đúng Supabase project trước khi dùng tính năng Cấu hình giao diện.
3. Chép đè đúng các file theo cấu trúc trong ZIP, commit/push lên GitHub.
4. Chờ Cloudflare Pages deploy thành công, sau đó kiểm tra trực tiếp URL `/employee-master` và Reload.

## Quy tắc dữ liệu
- Không xóa hoặc sửa dữ liệu nhân sự hiện có bằng migration này.
- `employee_code` là định danh nghiệp vụ; `employees.id` và khóa ngoại hiện hữu vẫn được giữ nguyên.
- Bỏ chọn “Hiện trên danh sách” chỉ ẩn cột khỏi bảng danh sách; trường vẫn hiển thị trong Hồ sơ chi tiết.
- Ngừng sử dụng cột không xóa giá trị đã lưu trong hồ sơ; cấu hình đánh dấu inactive và giữ lại dữ liệu.
- Header Excel mới được lưu trong `custom_fields`, không tự tạo cột vật lý PostgreSQL.

## Kiểm tra đã thực hiện
- Đã chạy kiểm tra cú pháp JSX/ES module bằng TypeScript transpileModule; không phát hiện lỗi cú pháp.
- Không thể chạy `npm run build` trong môi trường này do `npm install` hết thời gian.
- Chưa kiểm thử trực tiếp với Supabase production; cần xác nhận migration, RLS và thao tác CRUD sau deploy.
