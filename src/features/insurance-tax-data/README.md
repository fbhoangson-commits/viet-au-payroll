# Dữ Liệu Bảo Hiểm và Thuế

Module `/insurance-tax-data` quản lý dữ liệu BHXH, người phụ thuộc, hỗ trợ và thông tin thuế áp dụng theo từng kỳ lương.

- Danh sách nhân sự lấy từ `payroll_period_employees` (snapshot đã chốt), không tự lấy toàn bộ Nhân Sự Master để đưa vào kỳ.
- Dữ liệu gốc tham chiếu: `employee_insurance_profiles`, `employee_tax_dependents`, `employee_income_commitments`, `employee_support_allowances`, `payroll_tax_relief_config`.
- Điều chỉnh theo kỳ được lưu riêng tại `payroll_period_insurance_tax_data`.
- Chạy migration `supabase/migrations/20261027_payroll_period_insurance_tax_data.sql` sau khi kiểm tra schema và RLS trên môi trường mục tiêu.
- Công thức thuế hiển thị hiện dùng số `taxable_income_override` nhập để đối chiếu; chưa tự ghi kết quả vào phiếu lương. Tích hợp module TÍNH LƯƠNG cần xác minh nguồn thu nhập thực tế và quy tắc nghiệp vụ trước khi triển khai.
- Mức thuế khấu trừ 10% chỉ là ước tính cho trường hợp được xác nhận áp dụng; không tự động miễn thuế nếu cam kết chưa xác minh.
