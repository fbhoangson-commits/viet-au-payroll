# Bản vá theo source `viet-au-payroll-main (5)(7).zip`

## Phạm vi
Chỉ thay đúng 2 file trong source Sơn vừa gửi:
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`
- `src/features/insurance-tax-data/Page.jsx`

Không thay thế toàn bộ project, không sửa migration, database, Employee Master hoặc các module khác.

## Quy tắc được triển khai
- Cơ Hữu: giữ nguyên biểu thức tính thu nhập chịu thuế hiện tại của source gốc trong ZIP này.
- Hợp Đồng và Thỉnh Giảng: thu nhập chịu thuế tự tính = Lương cố định + Thành tiền tiết dạy + Khoản Cộng - Khoản Trừ.
- Vẫn giữ nguyên cơ chế `taxable_income_override`, loại trừ thuế và cam kết thu nhập hợp lệ.

## Đối chiếu VA104
12.275.000 + 8.107.794 + 400.000 - 438.393 = 20.344.401 đồng.

## Kiểm tra
- Đã xác nhận nhánh Cơ Hữu không đổi so với source ZIP gốc.
- Hai file JSX qua TypeScript transpile: 0 lỗi cú pháp.
- Chưa chạy `npm run build` và chưa kết nối/ghi Supabase production.

## Cách áp dụng
Giải nén ZIP và chép đè đúng 2 file theo đường dẫn tương ứng trong project hiện tại của Sơn. Không thay các file khác.
