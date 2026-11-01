PATCH: Ưu tiên phân loại nhân sự đã chốt trong kỳ lương

Thay file src/features/payroll-calculation/PayrollCalculationPage.jsx bằng file cùng đường dẫn trong gói này.

Thay đổi duy nhất: classificationOf(s,tax,master), thay vì classificationOf(master,s,tax). Snapshot kỳ lương và dữ liệu thuế kỳ lương được ưu tiên; Employee Master là fallback.
Không thay đổi công thức Cơ Hữu, Hợp Đồng, Thỉnh Giảng, khoản cộng/trừ, BHXH, Công đoàn hoặc dữ liệu.
