PATCH-KHAC-3-COLUMNS-FIX-V3

Nguồn sửa: viet-au-payroll-main (2)(1).zip do người dùng gửi trong phiên hiện tại.

Nguyên nhân kỹ thuật được xác định trong mã nguồn:
- teaching-attendance xây map đơn giá bằng cách thay thế toàn bộ values object khi có nhiều dòng cùng employee_id + group_id; có thể làm mất đơn giá của các cột khác.
- insurance-tax-data cũng ghi đè toàn bộ values object khi nhiều dòng cùng employee_id + group_id.
- payroll-calculation chọn dòng đầu tiên theo nhóm rồi chỉ tra đơn giá trong dòng đó; nếu cột nằm ở dòng khác thì báo thiếu đơn giá.

Bản vá này chỉ sửa cách hợp nhất/tra cứu values theo từng cột trong 3 file:
- src/features/teaching-attendance/Page.jsx
- src/features/payroll-calculation/PayrollCalculationPage.jsx
- src/features/insurance-tax-data/Page.jsx

Không thay đổi công thức thuế, mức giảm trừ, phân loại nhân sự, schema, giao diện, hay luồng lưu chấm tiết.

Cách áp dụng:
1. Sao lưu repository hiện tại.
2. Giải nén vào thư mục gốc repository, ghi đè đúng 3 file nêu trên.
3. Chạy npm run build.
4. Chỉ deploy nếu build thành công.
5. Kiểm tra kỳ lương bị lỗi: cả 3 cột nhóm Khác phải có đơn giá trong Chấm Tiết, được tính vào Thành Tiền Tiết Dạy/Tổng Thu Nhập và được đưa vào nguồn tính thu nhập thuế.

Giới hạn kiểm chứng:
- Đã kiểm tra các điểm sửa trong mã nguồn.
- Chưa chạy được build Vite trong môi trường này do không có node_modules.
- Chưa truy cập được Supabase production, nên chưa thể xác nhận dữ liệu thật hoặc kết quả sau deploy.
