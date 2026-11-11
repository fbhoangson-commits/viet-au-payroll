# PATCH - Ẩn menu theo quyền

## Phạm vi
- Lấy nguyên source hiện tại làm gốc.
- Chỉ thay đổi `src/main.jsx`.
- `SUPER_ADMIN`: giữ nguyên toàn bộ menu.
- `PAYROLL_ACCOUNTANT`: ẩn nhóm `QUẢN LÝ HỆ THỐNG` khỏi sidebar.
- Không thay đổi `navigation.js`, các Page, nghiệp vụ lương, dữ liệu hoặc cấu hình Supabase.

## Lưu ý
Patch này chỉ xử lý hiển thị menu theo role trên sidebar, đúng phạm vi yêu cầu. Không thay đổi cơ chế phân quyền truy cập route/database hiện có.
