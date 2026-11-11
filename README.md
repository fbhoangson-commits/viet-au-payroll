# VA Payroll - Sửa Export/Import Nhân Sự Master

Chỉ thay đổi:
- src/features/employee-master/Page.jsx

Đã xử lý:
1. Export Excel dùng tiêu đề tiếng Việt rõ ràng.
2. Không xuất các trường nội bộ `id`, `created_at`, `updated_at`.
3. Tên sheet là `Nhân Sự`; sheet hướng dẫn là `Hướng Dẫn`.
4. Template không còn trống hoàn toàn: có sẵn hàng Header tiếng Việt để nhập dữ liệu.
5. Import nhận diện các Header tiếng Việt tương ứng.
6. Export/Template tự động giãn độ rộng cột theo nội dung, có giới hạn để không quá rộng.
7. Không thay đổi nghiệp vụ lưu nhân sự, tính lương hoặc dữ liệu Supabase.

Thay đúng file vào source hiện tại rồi deploy frontend.
