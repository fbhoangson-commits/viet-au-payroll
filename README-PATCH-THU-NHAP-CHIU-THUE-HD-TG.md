# PATCH – Thu nhập chịu thuế Hợp Đồng và Thỉnh Giảng

## File thay thế
`src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Phạm vi
- Ưu tiên `employee_type` / `employee_classification` của bản ghi thuế theo kỳ (`payroll_period_insurance_tax_data`) khi xác định loại nhân sự để tính lương kỳ đó.
- Chỉ khi bản ghi theo kỳ không có phân loại mới dùng phân loại từ Employee Master / snapshot làm dự phòng.
- Giữ nguyên nhánh công thức Cơ Hữu.
- Giữ nguyên công thức Hợp Đồng và Thỉnh Giảng hiện có: lương cố định + tiền tiết dạy + khoản cộng - khoản trừ.
- Giữ nguyên nhánh các nhóm khác, `taxable_income_override`, cam kết thu nhập, cách tính Thuế TNCN, BHXH, Công đoàn và thực lĩnh.

## Lý do
Trong mã gốc, `classificationOf(master,s,tax)` và `firstText(classification,...)` ưu tiên phân loại từ Employee Master trước phân loại riêng của kỳ lương. Nếu Employee Master có giá trị khác với loại nhân sự đã chọn trong Dữ Liệu Kỳ Lương, Tính Lương có thể đi vào nhánh công thức khác. Bản vá chỉ đổi thứ tự ưu tiên nguồn phân loại để dữ liệu theo kỳ được áp dụng đúng.

## Kiểm thử cần thực hiện sau deploy
1. VA104 – T09/2026: xác nhận phân loại theo kỳ là Hợp Đồng hoặc Thỉnh Giảng.
2. Kiểm tra thu nhập chịu thuế: 12.275.000 + 8.107.794 + 400.000 - 438.393 = 20.344.401đ.
3. Kiểm tra Cơ Hữu mẫu: kết quả trước/sau phải không thay đổi.
4. Kiểm tra nhân sự thuộc nhóm khác: kết quả trước/sau phải không thay đổi.

Chưa chạy build production trong môi trường đóng gói do không có `node_modules`; cần chạy build trong môi trường dự án trước khi deploy.
