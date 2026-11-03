VA-BANK – KHÔI PHỤC MENU TÀI KHOẢN NGÂN HÀNG

Nguồn đối chiếu: viet-au-payroll-main (6)(4).zip

Thay đổi:
- Bổ sung mục “Tài khoản ngân hàng” trong nhóm “NHÂN SỰ”.
- Slug: employee-bank.
- Icon: landmark.
- Không sửa Page.jsx, CSS, SQL, dữ liệu hoặc nghiệp vụ khác.

Cập nhật:
1. Giải nén ZIP.
2. Chép src/app/navigation.js vào đúng đường dẫn trong repository.
3. Commit/push để Cloudflare Pages deploy.
4. Mở /employee-bank hoặc chọn NHÂN SỰ > Tài khoản ngân hàng.

Ghi chú:
- main.jsx dùng import.meta.glob('./features/*/Page.jsx'), vì vậy trang employee-bank/Page.jsx hiện có sẽ tự được ánh xạ theo slug.
- Page.jsx tự kiểm tra role SUPER_ADMIN hoặc PAYROLL_ACCOUNTANT; người không có quyền sẽ không được quản lý hồ sơ ngân hàng.
- Đây là patch điều hướng một file, không cần chạy SQL.
