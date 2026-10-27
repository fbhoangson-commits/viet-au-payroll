PATCH TÍNH LƯƠNG 8 MENU - V3

File thay đổi:
  src/features/payroll-calculation/PayrollCalculationPage.jsx

Các sửa đổi theo phản hồi:
- Đặt tiêu đề cột taxAmount là “Thuế TNCN” và hiển thị tiền theo định dạng VND thống nhất với các cột tiền khác.
- Đọc số thuế đã lưu từ các tên trường thông dụng (tax_amount, personal_income_tax_amount, income_tax_amount, pit_amount, tax_payable, withholding_tax_amount); chỉ ước tính theo công thức hiện có khi không có giá trị thuế lưu sẵn.
- Ghép dữ liệu thuế theo employee_id hoặc employee_code để tránh bỏ sót bản ghi do khóa liên kết khác nhau.
- Cột tiết dạy hiển thị tên cột gọn, bỏ hậu tố “Số tiết”; bỏ cột trạng thái tiết dạy khỏi bảng.
- Trạng thái Nhân Sự Kỳ Lương phản ánh việc liên kết với hồ sơ Employee Master, thay vì phụ thuộc dữ liệu thuế.

Cách áp dụng:
- Đây là bản thay thế cho file cùng đường dẫn trong PATCH-TINH-LUONG-8-MENU-V2.
- Nếu repository chưa có module tổng hợp Tính Lương, cần áp dụng PATCH-TINH-LUONG-8-MENU-V1 trước.
- Không có migration và không ghi dữ liệu lên Supabase.

Kiểm tra:
- Cần chạy npm run build trong repository sau khi áp dụng.
- Chưa xác minh trực tiếp schema production; nếu cột thuế trong bảng dữ liệu có tên khác các tên trên, cần bổ sung đúng tên trường theo schema thật.
