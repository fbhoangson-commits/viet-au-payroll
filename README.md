# PATCH ẨN MENU THEO QUYỀN

Cơ sở: `viet-au-payroll-main (9)(1).zip`

Phạm vi duy nhất: `src/main.jsx`

- Giữ nguyên `NAV_GROUPS`, route và toàn bộ logic hiện có.
- Đọc `system_roles.code` từ dữ liệu role hiện tại.
- `SUPER_ADMIN`: giữ nguyên toàn bộ menu, bao gồm `QUẢN LÝ HỆ THỐNG`.
- Các role khác, trong đó có `PAYROLL_ACCOUNTANT`: ẩn nhóm `QUẢN LÝ HỆ THỐNG` khỏi sidebar.
- Bộ lọc tìm kiếm cũng không đưa nhóm đã ẩn trở lại.
- Không sửa Page, nghiệp vụ lương, dữ liệu hoặc RLS.
