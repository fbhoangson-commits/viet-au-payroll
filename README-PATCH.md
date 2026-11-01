# PATCH – Ưu tiên phân loại kỳ lương cho Hợp Đồng / Thỉnh Giảng

## File thay thế
`src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Sửa gì
- Ưu tiên `classification` đang được xác định cho kỳ lương trước `tax.employee_type` cũ.
- Nếu phân loại hiệu lực là Hợp Đồng hoặc Thỉnh Giảng, nhánh này được ưu tiên và không bị nhánh Cơ Hữu kích hoạt bởi `employee_type` cũ/mâu thuẫn.
- Không thay đổi công thức Cơ Hữu; không thay đổi công thức thuế, BHXH, Công đoàn hoặc dữ liệu Supabase.

## Kiểm tra logic
Với VA104: 12.275.000 + 8.107.794 + 400.000 - 438.393 = 20.344.401.

Chỉ thay file nêu trên. Chưa chạy build production trong môi trường này.
