PATCH-KHAC-3-COLUMNS-FIX-V4

Nguồn: viet-au-payroll-main (2)(1).zip do người dùng gửi trong cuộc trò chuyện này.

NGUYÊN NHÂN TÌM THẤY TRONG CODE
- teaching-attendance/Page.jsx: rateMap chọn nguyên object values từ một dòng salary_rate_values theo employee_id + group_id. Nếu có nhiều dòng chính sách/đơn giá và mỗi dòng có các khóa cột khác nhau, các cột ở dòng còn lại bị mất.
- payroll-calculation/PayrollCalculationPage.jsx: khi tính từng bản ghi chấm tiết, code chọn một dòng rate theo group_id trước rồi mới tra cột. Nếu dòng đó không chứa đơn giá cột đang tính, đơn giá bị coi là thiếu dù có ở dòng khác.
- insurance-tax-data/Page.jsx: ratesByEmployeeGroup và allRatesByEmployeeGroup đều map theo employee_id + group_id và ghi đè object values của dòng trước, làm mất đơn giá cột ở dòng khác.

SỬA ĐỔI
- Tra cứu đơn giá theo từng cột, ưu tiên dòng thuộc phiên bản chính sách của kỳ lương; nếu cột không có giá trị ở dòng ưu tiên thì tìm tiếp các dòng còn lại của cùng nhân sự/nhóm.
- Không thay đổi công thức thuế, mức giảm trừ, phân loại nhân sự hay giao diện.
- Chỉ gồm 3 file mã nguồn ở các đường dẫn tương ứng.

ÁP DỤNG
1. Sao lưu repository hiện tại.
2. Giải nén vào thư mục gốc repository, ghi đè đúng 3 file được cung cấp.
3. Chạy npm install (nếu môi trường chưa có dependencies), sau đó npm run build.
4. Chỉ triển khai nếu build thành công; kiểm tra một nhân sự có số tiết ở cả 3 cột nhóm Khác trong cùng kỳ.

KIỂM CHỨNG
- Đã kiểm tra vị trí logic và diff trên mã nguồn.
- Chưa chạy được vite build trong môi trường tạo patch vì node_modules không có và vite chưa cài đặt.
- Chưa kết nối Supabase production, nên chưa thể kiểm tra bản ghi dữ liệu thực tế.
