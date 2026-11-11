# VA – FIX TỰ SINH MÃ NHÂN VIÊN

Nguồn sửa: `viet-au-payroll-main (8)(1).zip`.

Phạm vi duy nhất:
- Khi thêm nhân sự mới, hệ thống tự đọc dữ liệu `employees` hiện tại và sinh mã `VA` + số lớn nhất + 1.
- Ví dụ `VA143` → `VA144`, `VA146` → `VA147`.
- Nếu chưa có mã VA hợp lệ → `VA001`.
- Ô Mã Nhân Viên bị khóa, không cho nhập/sửa.
- Ngay trước khi lưu hồ sơ mới, hệ thống đọc lại dữ liệu và sinh lại mã để tránh dùng mã cũ do form mở lâu.
- Import Excel không bị thay đổi: vẫn nhận Mã Nhân Viên từ file để đối chiếu/cập nhật.

Không thay đổi công thức lương, dữ liệu kỳ lương, RBAC, ngân hàng hoặc module khác.

Lưu ý kiểm thử: source package không có `node_modules`, vì vậy chưa chạy được `npm run build` trong môi trường kiểm tra này.
