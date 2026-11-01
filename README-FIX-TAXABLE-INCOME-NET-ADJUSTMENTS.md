# FIX: Chỉ trừ Khoản Trừ cho Hợp Đồng và Thỉnh Giảng

## Phạm vi sửa
- Cơ Hữu: giữ nguyên công thức cũ hoàn toàn. Biến `totalIncomeForTax` tiếp tục là Lương cố định + Tiết dạy + Khoản Cộng; nhánh giảm trừ Cơ Hữu không bị thay đổi.
- Hợp Đồng và Thỉnh Giảng: Thu nhập chịu thuế tự tính = max(0, Lương cố định + Tiết dạy + Khoản Cộng - Khoản Trừ).
- Tổng Hợp Lương đã áp dụng phép trừ trong nhánh `!isPermanent` בלבד.
- Dữ Liệu Bảo Hiểm và Thuế: phép trừ `income.deductions` chỉ nằm trong nhánh `!isPermanent`; nhánh Cơ Hữu dùng nguyên `totalIncomeForTax` như trước.
- Không thay đổi quy tắc cam kết thu nhập hợp lệ, loại trừ thuế hoặc giá trị điều chỉnh thủ công.

## Hai file
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`
- `src/features/insurance-tax-data/Page.jsx`

## Kiểm tra
- Đối chiếu diff: thay đổi chỉ nằm trong nhánh Hợp Đồng/Thỉnh Giảng ở cả hai module; công thức Cơ Hữu được giữ nguyên so với source trước bản vá.
- JSX transpile sẽ được kiểm tra trước bàn giao.
- Không chạy migration, không ghi dữ liệu Supabase.
