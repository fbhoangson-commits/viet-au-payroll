# PATCH – Fix Thu nhập chịu thuế Hợp Đồng / Thỉnh Giảng

## File thay thế
`src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Nguồn
Tạo từ mã nguồn `viet-au-payroll-main (9).zip` do người dùng cung cấp.

## Nguyên nhân xác định trong code
Mã cũ xác định nhánh Hợp Đồng / Thỉnh Giảng chỉ từ `employeeType`. Trong khi cột Phân loại đang hiển thị ở bảng được xác định từ `classificationOf(master, snapshot, tax)`. Hai nguồn này có thể khác nhau; khi `employeeType` thiếu hoặc khác nhãn, nhân sự Hợp Đồng không vào nhánh trừ Khoản Trừ. Khi đó kết quả đúng bằng Lương cố định + Tiết dạy + Khoản cộng (20.782.794đ ở VA104).

Ngoài ra, `estimateTax()` ưu tiên `taxable_income_override` cũ trong bản ghi thuế. Bản vá bỏ override này riêng cho Hợp Đồng / Thỉnh Giảng khi tính thuế, để thuế dùng đúng căn cứ `taxable` vừa tính.

## Thay đổi
- Nhận diện Hợp Đồng / Thỉnh Giảng từ cả `employeeType` và `classification` đang hiển thị.
- Giữ công thức hiện tại: Lương cố định + Tiết dạy + Khoản cộng - Khoản Trừ.
- Khi tính Thuế TNCN cho Hợp Đồng / Thỉnh Giảng, bỏ override cũ; dùng `taxable` đã tính.
- Cơ Hữu và các nhóm khác giữ nguyên nhánh tính và cơ chế override.
- Không thay đổi schema, dữ liệu Supabase, Realtime, giao diện hoặc các công thức khác.

## Đối chiếu VA104
12.275.000 + 8.107.794 + 400.000 - 438.393 = 20.344.401đ.
Thuế TNCN 10% = 2.034.440đ (làm tròn đến đồng).

Chưa chạy build production trong môi trường đóng gói. Sau khi thay file và deploy, kiểm tra VA104 ở kỳ T09/2026 và đối chiếu một nhân sự Cơ Hữu.
