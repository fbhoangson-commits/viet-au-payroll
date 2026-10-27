# PATCH TÍNH LƯƠNG V5 — Sửa đúng phạm vi hiển thị và Khoản Cộng Trừ

## Phạm vi
Chỉ thay đổi `src/features/payroll-calculation/PayrollCalculationPage.jsx`.

## Thu Nhập Chịu Thuế và Thuế TNCN
Hai cột chỉ xuất hiện ở đúng 4 menu được yêu cầu:
- Tổng Quan Kỳ Lương (`payroll-overview`)
- Bảo Hiểm & Phí Công Đoàn (`insurance-union`)
- Thuế TNCN (`personal-income-tax`)
- Tổng Hợp Lương (`payroll-summary`)

Đã bỏ hai cột này khỏi Nhân Sự Kỳ Lương, Lương Cố Định, Lương Tiết Dạy & Phụ Đạo và Khoản Cộng Trừ.

Cách tính dự phòng thuế trong bảng tổng hợp được đồng bộ với quy tắc đang dùng trong `insurance-tax-data`: cam kết chỉ miễn khấu trừ khi đã xác minh; Cơ Hữu dùng biểu lũy tiến hiện có; nhóm còn lại theo ngưỡng khấu trừ 10% hiện có. Không ghi ngược kết quả vào bảng dữ liệu thuế.

## Khoản Cộng Trừ
- Đổi nhãn kỹ thuật `additionCount`, `deductionCount`, `difference` thành nhãn tiếng Việt.
- Hiển thị Tiền Cộng, Tiền Trừ và Chênh Lệch theo định dạng tiền VND, có dấu phân cách hàng nghìn và không hiện số thập phân rác.
- Dòng tổng cộng cộng đúng số khoản và tổng chênh lệch.

## Cập nhật
Giải nén vào thư mục gốc repository, ghi đè đúng file trên. Chạy `npm run build` trước khi commit/push. Bản vá không thay đổi schema database và không ghi dữ liệu Supabase.
