# Bản vá BHXH đơn vị 21,5% — V5

## Phạm vi
- `src/features/insurance-tax-report/Page.jsx`
- `src/features/salary-fund-report/Page.jsx`

## Quy tắc
- BHXH đơn vị trên Báo cáo BHXH & thuế và Báo cáo quỹ lương được tổng hợp từ `payroll_period_insurance_tax_data`.
- Chỉ tính nhân sự có `participates_insurance` xác nhận tham gia và có `insurance_salary_base`.
- Công thức báo cáo: `Math.round(insurance_salary_base * 0.215)`.
- Kết quả chỉ dùng để hiển thị báo cáo; không ghi ngược vào Supabase, không thay đổi snapshot và không sửa công thức tính lương.
- Nếu dữ liệu kỳ không đủ, giữ fallback số tiền đã lưu trong snapshot/hồ sơ hiện có.

## Áp dụng
Giải nén vào thư mục gốc dự án, giữ nguyên đường dẫn, sau đó build và triển khai. Kiểm tra lại cùng kỳ và phiên bản ở cả hai màn hình.
