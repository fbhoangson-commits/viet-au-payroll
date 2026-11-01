# PATCH – Sửa thứ tự ưu tiên phân loại nhân sự khi tính lương

## File thay thế
`src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Thay đổi duy nhất
Đổi `classificationOf(master,s,tax)` thành `classificationOf(s,tax,master)`.

Hàm `classificationOf` trả về giá trị đầu tiên tìm thấy. Do đó dữ liệu kỳ lương và dữ liệu thuế của kỳ được ưu tiên trước Employee Master, tránh phân loại cũ trong Master làm chọn nhầm nhánh tính.

Không thay công thức tính, `estimateTax`, override, Realtime, BHXH, Công đoàn hoặc dữ liệu Supabase.
