# PATCH TÍNH LƯƠNG V7

## Mục tiêu
Sửa sai lệch Thu Nhập Chịu Thuế và Thuế TNCN giữa các màn hình TÍNH LƯƠNG và trang Dữ Liệu Bảo Hiểm và Thuế.

## Phạm vi
Chỉ thay đổi `src/features/payroll-calculation/PayrollCalculationPage.jsx`.

## Nguyên nhân đã xác định từ mã nguồn
Trang `insurance-tax-data` đọc số người phụ thuộc từ cả các trường trực tiếp và `employees.custom_fields`. Màn hình tổng hợp trước đây chỉ đọc trường trực tiếp, nên một số nhân sự bị bỏ sót giảm trừ người phụ thuộc. Ví dụ mức chênh lệch 6.200.000 đồng ở thu nhập chịu thuế kéo theo chênh lệch 620.000 đồng tiền thuế trong ảnh được cung cấp.

## Sửa đổi
- Đồng bộ cách tìm số người phụ thuộc với `src/features/insurance-tax-data/Page.jsx`, bao gồm `custom_fields` và cùng thứ tự ưu tiên nguồn.
- Không tự thêm cột vào các menu ngoài phạm vi đã chốt trong V5/V6.
- Không sửa database, không ghi dữ liệu thuế mới vào Supabase.

## Cập nhật
Giải nén vào thư mục gốc repository và ghi đè đúng file nêu trên. Chạy `npm run build` trước khi commit/push.

## Giới hạn xác minh
Chưa chạy build Vite hoàn chỉnh và chưa truy cập trực tiếp Supabase production trong quá trình tạo bản vá. Sau khi cập nhật, đối chiếu cùng kỳ và mã nhân viên giữa `/insurance-tax-data` và 4 menu được phép hiển thị thuế.
