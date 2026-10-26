# Nhân Sự Master — V10

Module nằm tại `src/features/employee-master/` và sử dụng Supabase `public.employees` làm nguồn dữ liệu.

## Đưa lên GitHub
1. Giải nén ZIP vào một thư mục riêng để kiểm tra.
2. Sao lưu repository hiện tại.
3. Chép đè các file trong ZIP lên repository `fbhoangson-commits/viet-au-payroll`, giữ nguyên cấu trúc thư mục.
4. Commit/push lên GitHub để Cloudflare Pages build lại.

## Cấu hình
- Cần có `VITE_SUPABASE_URL`
- Cần có `VITE_SUPABASE_ANON_KEY` (publishable key tương thích client)
- Không đưa service-role/secret key vào frontend.

## Phạm vi đã triển khai
- Tải danh sách và thống kê từ Supabase.
- Tìm kiếm, lọc trạng thái, lọc hai cấp trường/giá trị, phân trang.
- Xem/sửa hồ sơ và thêm hồ sơ theo các cột nghiệp vụ mặc định.
- Import XLSX/XLS/CSV có xem trước, kiểm tra mã trùng trong file; đối chiếu theo `employee_code`.
- Export/template Excel có sheet hướng dẫn.
- Dùng RLS hiện có để quyết định quyền database; không sửa schema hoặc RLS.

## Quan trọng trước khi sử dụng
Schema thật của `public.employees` chưa được đọc trực tiếp trong môi trường tạo ZIP này. Code cố ý không tạo migration và không tự sửa RLS. Nếu schema dùng tên cột khác với `employee_code`, `full_name`/`name`, `status`, `department`, `position`, `phone`, `email`, thao tác có thể báo lỗi database; hãy gửi nguyên văn lỗi để chỉnh đúng schema, không chạy SQL đoán mò.

Tài khoản `app_users` được kiểm tra theo các khóa phổ biến `id`, `auth_user_id`, `user_id` chỉ để hiển thị trạng thái ánh xạ. Việc cho phép đọc/ghi cuối cùng vẫn do chính sách RLS của Supabase quyết định. Phân quyền vai trò cụ thể chưa thể xác nhận nếu chưa biết schema `app_users`.

## Kiểm thử
Build chưa được xác minh trong môi trường đóng gói này vì không thể cài dependencies (Vite không có trong môi trường hiện tại). Sau khi push, kiểm tra Cloudflare build log trước khi dùng production. Không đưa hồ sơ nhân sự thử nghiệm vào database thật nếu chưa thống nhất.
