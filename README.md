# VIỆT ÂU PAYROLL – Báo cáo BHXH & thuế V3

## Thay đổi
- Chỉ sửa KPI tổng "Giảm trừ cá nhân" trong tab Thuế TNCN.
- Công thức hiển thị: số nhân sự có `participates_insurance === true` trong kỳ đang chọn × 15.500.000 VND.
- Giữ nguyên trường giảm trừ cá nhân của từng nhân viên trong bảng chi tiết, không sửa snapshot, không ghi dữ liệu lên Supabase, không thay đổi công thức tính lương.

## Áp dụng
Chép `src/features/insurance-tax-report/Page.jsx` vào dự án theo đúng đường dẫn.
