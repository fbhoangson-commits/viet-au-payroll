# Điều chỉnh Thu nhập chịu thuế = Lương + Tiết dạy + (Khoản Cộng - Khoản Trừ)

## Thay đổi
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`: với nhân sự không thuộc Cơ Hữu (Hợp Đồng/Thỉnh Giảng), thu nhập chịu thuế tự tính trừ `deductions` khỏi `fixed + teaching + additions`.
- `src/features/insurance-tax-data/Page.jsx`: công thức `totalIncomeForTax` cũng trừ `income.deductions`, để màn hình Dữ liệu BHXH và Thuế và Tổng Hợp Lương hiển thị cùng căn cứ.
- Công thức Cơ Hữu giữ nguyên nhánh tính giảm trừ cá nhân, người phụ thuộc, BHXH và các khoản liên quan; chỉ đưa Khoản Trừ vào cơ sở thu nhập trước khi áp dụng các giảm trừ như cách đang dùng tại Tổng Hợp Lương.

## Công thức
Thu nhập chịu thuế tự tính = max(0, Lương cố định + Thành tiền tiết dạy + Khoản cộng - Khoản trừ)
- Hỗ trợ nhân sự và Thuế hỗ trợ vẫn được xử lý riêng như logic hiện tại.
- `taxable_income_override` nếu có vẫn được ưu tiên như trước.
- Cam kết thu nhập hợp lệ và cờ loại trừ thuế vẫn giữ nguyên.

## Kiểm tra
- Hai file JSX đã qua TypeScript transpile, 0 diagnostics.
- Chưa chạy npm build do môi trường source không có node_modules.
- Không ghi dữ liệu Supabase, không chạy migration.
