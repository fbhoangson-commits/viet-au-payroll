# PATCH TÍNH LƯƠNG V4 — Đồng bộ Thu Nhập Chịu Thuế và Thuế TNCN

## File thay đổi
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Sửa lỗi
- Thêm hai cột `Thu Nhập Chịu Thuế` và `Thuế TNCN` vào tất cả 8 menu TÍNH LƯƠNG.
- Đồng bộ cách định dạng tiền VND và dòng tổng cho cả hai cột.
- Đọc dữ liệu thuế theo kỳ bằng `employee_id`, dự phòng đối chiếu `employee_code`/`employee_code_snapshot`.
- Khi bảng dữ liệu thuế chưa có thu nhập chịu thuế đã lưu, tính dự phòng theo cùng quy tắc đang dùng trong module Bảo Hiểm & Thuế: Cơ Hữu trừ khoản trừ, hỗ trợ, giảm trừ gia cảnh và bảo hiểm NLĐ; Hợp Đồng/Thỉnh Giảng dùng lương cố định + tiết dạy + khoản cộng.
- Khi chưa có tiền thuế đã lưu hoặc số đã lưu bằng 0, ước tính theo phân loại và thu nhập chịu thuế; cam kết chỉ miễn khấu trừ khi được đánh dấu đã xác minh hợp lệ.
- Đọc cấu hình giảm trừ thuế và cam kết thu nhập từ nguồn hiện có, không ghi dữ liệu vào Supabase.

## Cập nhật
Giải nén vào thư mục gốc repository và ghi đè đúng file nêu trên. Chạy `npm run build`; chỉ push lên GitHub nếu build thành công.

## Lưu ý
Đây là lớp tổng hợp chỉ đọc, không migration database và không ghi dữ liệu thuế vào bảng nguồn. Giá trị dự phòng được tính trong màn hình, không thay thế việc xác nhận dữ liệu chính thức trong module Bảo Hiểm & Thuế. Đối chiếu số liệu thực tế theo kỳ trước khi chốt lương.
