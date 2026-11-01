# PATCH – Đồng bộ số tiền Khoản bổ sung/điều chỉnh giữa Dữ Liệu Kỳ Lương và Tính Lương

## File thay đổi
`src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Nguyên nhân
Màn hình Dữ Liệu Kỳ Lương tính số tiền điều chỉnh theo `amount ?? (quantity * unit_price)`, trong khi Tính Lương chỉ cộng `amount`. Nếu `amount` trống nhưng `quantity` và `unit_price` có dữ liệu, Tính Lương đọc khoản điều chỉnh thành 0.

## Sửa đổi
Dùng cùng quy tắc xác định số tiền điều chỉnh cho cả ADD và DEDUCT: `amount` nếu có; nếu không thì `quantity * unit_price`. Giữ nguyên lọc nhân viên, kỳ áp dụng, trạng thái, phân loại và toàn bộ công thức tính lương hiện hành.

Không có migration SQL và không thay đổi dữ liệu Supabase.

## Kiểm thử cần làm sau deploy
1. Mở cùng kỳ lương ở Dữ Liệu Kỳ Lương và Tính Lương.
2. Kiểm tra VA104: Khoản Trừ phải được đọc đủ 438.393đ.
3. Với Hợp Đồng/Thỉnh Giảng, Thu nhập chịu thuế phải là 20.344.401đ theo cấu phần đã xác nhận.
4. Đối chiếu ít nhất một Cơ Hữu để bảo đảm kết quả không đổi.

Build production chưa được xác nhận trong môi trường đóng gói.
