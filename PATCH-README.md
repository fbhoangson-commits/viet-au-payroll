PATCH DỮ LIỆU BẢO HIỂM VÀ THUẾ TNCN V1 — ĐÚNG ĐƯỜNG DẪN REPOSITORY

Giải nén trực tiếp tại thư mục gốc repository `viet-au-payroll` để các file nằm đúng đường dẫn. Không chép cả thư mục wrapper.

Files:
- `src/features/insurance-tax-data/Page.jsx`
- `src/features/insurance-tax-data/styles/insurance-tax-data.css`
- `src/features/insurance-tax-data/README.md`
- `supabase/migrations/20261027_payroll_period_insurance_tax_data.sql`

Đã chỉnh import CSS trong Page.jsx thành `./styles/insurance-tax-data.css` để khớp đường dẫn file.

Trước khi áp dụng: sao lưu repository; kiểm tra schema/RLS Supabase; đọc migration trước khi chạy. Chưa xác nhận build production hoặc ghi dữ liệu Supabase thực tế.
