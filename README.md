# VA16 - FIX DỮ LIỆU DÙNG CHUNG + ẨN MENU THEO QUYỀN

Dựa trên `viet-au-payroll-main (16).zip`.

## 1. Dữ liệu dùng chung
Thêm migration `20261111_sync_shared_data_rbac.sql`:
- `payroll_can_operate()` nhận SUPER_ADMIN và PAYROLL_ACCOUNTANT.
- `payroll_is_super_admin()` chỉ nhận SUPER_ADMIN.
- Employee Master cho phép 2 vai trò truy cập dữ liệu dùng chung.
- Không xóa/sửa dữ liệu payroll hiện có.

## 2. Ẩn menu
`src/main.jsx`:
- SUPER_ADMIN: giữ toàn bộ menu.
- PAYROLL_ACCOUNTANT: ẩn nhóm CẤU HÌNH LƯƠNG và các menu quản trị hệ thống không được cấp quyền.
- Giữ `Nhật ký hoạt động` trong QUẢN LÝ HỆ THỐNG.
- Nếu đang ở URL bị ẩn, tự chuyển về menu được phép.

## Triển khai
1. Chạy SQL trong Supabase SQL Editor.
2. Deploy lại web bằng `src/main.jsx`.
3. Đăng xuất/đăng nhập lại tài khoản KẾ TOÁN TIỀN LƯƠNG.
