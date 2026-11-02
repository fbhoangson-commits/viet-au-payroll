# VA-PAYROLL — Quản lý chi trả lương

## Phạm vi
- Menu mới `DUYỆT LƯƠNG – BÁO CÁO > Quản lý chi trả lương`.
- Chỉ lấy phiên bản `APPROVED` hoặc `LOCKED`.
- Tạo danh sách từ `payroll_runs.input_snapshot`, lấy nguyên `net_pay`; không tính lại lương.
- Tự xếp `BANK` khi tài khoản VA-BANK tồn tại và đã xác minh; các trường hợp còn lại xếp `HOLD`.
- Theo dõi chuyển khoản, tiền mặt, treo chờ trả, trả một phần và đã thanh toán.
- Có thể ghi nhận thanh toán nhiều lần; trigger SQL khóa dòng và chặn tổng số tiền ghi nhận vượt `Thực lĩnh`.
- Xuất Excel nhóm đang lọc để đối soát nội bộ. Chưa xuất file upload ngân hàng; cần template MSB chính thức.

## Cập nhật
1. Chạy `supabase/migrations/20261102_payroll_disbursements.sql` trong Supabase SQL Editor.
2. Chép các file trong ZIP vào đúng đường dẫn repository GitHub.
3. Push GitHub để Cloudflare Pages deploy.

## Phụ thuộc
- Migration VA-BANK `20261102_employee_bank_accounts.sql` phải được chạy trước.
- Các bảng `payroll_runs`, `payroll_periods`, `employees`, các hàm `system_has_role()` và vai trò `SUPER_ADMIN`, `PAYROLL_ACCOUNTANT` phải tồn tại.
- Build chưa được chạy trong môi trường đóng gói vì ZIP nguồn không kèm `node_modules`.

## Ghi chú
- Bản này không thay đổi công thức lương hoặc snapshot đã duyệt.
- Nếu một nhân viên không có mã nhân viên hoặc không có `net_pay` hợp lệ trong snapshot, hệ thống không tự tạo khoản chi trả cho dòng đó; cần rà soát dữ liệu snapshot.
