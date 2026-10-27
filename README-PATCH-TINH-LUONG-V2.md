PATCH TINH LUONG 8 MENU - V2

File thay doi:
  src/features/payroll-calculation/PayrollCalculationPage.jsx

Phạm vi:
- Đọc phân loại từ dữ liệu kỳ, Employee Master và các trường custom_fields/metadata tương ứng.
- Đọc phí Công đoàn NLĐ từ employee_union_profiles nếu dữ liệu kỳ chưa có khoản đã lưu.
- Tổng Quan và Tổng Hợp hiển thị tiền thuế định dạng VND, phí Công đoàn và trạng thái dễ hiểu hơn.
- Lương Cố Định hiển thị 4 cấu phần và tổng lương cố định.
- Lương Tiết Dạy & Phụ Đạo hiển thị số tiết theo từng cột cấu hình, tổng số tiết, trạng thái và thành tiền.
- Khoản Cộng Trừ hiển thị số khoản, tiền cộng, số khoản, tiền trừ và chênh lệch.
- Bảo Hiểm & Phí Công Đoàn bỏ cột BHXH đơn vị, đồng thời đọc phí Công đoàn NLĐ.
- Thuế TNCN bổ sung phương pháp tính thuế và định dạng tiền thuế.

Không có migration, không ghi dữ liệu lên Supabase và không thay đổi module ngoài lớp tổng hợp Tính Lương.

Lưu ý: Cần áp dụng trên phiên bản đã có các file của PATCH-TINH-LUONG-8-MENU-V1. Chưa thể xác nhận build hoàn chỉnh vì npm install dependencies trong môi trường kiểm tra bị timeout; cần chạy npm run build sau khi áp dụng vào repository.
