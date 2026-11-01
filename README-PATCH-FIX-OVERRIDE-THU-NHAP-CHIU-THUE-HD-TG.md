# PATCH – Fix override Thu nhập chịu thuế Hợp Đồng & Thỉnh Giảng

File thay đổi: `src/features/payroll-calculation/PayrollCalculationPage.jsx`

Nguyên nhân: nhánh Hợp Đồng/Thỉnh Giảng đã tính lương cố định + tiết dạy + khoản cộng - khoản trừ, nhưng `taxable_income_override` có thể ghi đè kết quả bằng số cũ.

Sửa: Hợp Đồng và Thỉnh Giảng dùng `calculatedTaxable` từ cấu phần lương kỳ hiện tại. Cơ Hữu và các nhóm khác giữ nguyên cơ chế override và công thức hiện tại.

Không thay đổi Realtime, schema, dữ liệu Supabase hoặc nghiệp vụ khác.

Đã kiểm tra ZIP chứa đúng file theo đường dẫn dự án. Chưa chạy build do môi trường không có node_modules.
