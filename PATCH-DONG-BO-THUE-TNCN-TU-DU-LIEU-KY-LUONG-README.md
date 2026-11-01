# PATCH – Đồng bộ Thuế TNCN từ Dữ Liệu Kỳ Lương

## Phạm vi
- Chỉ thay đổi `src/features/payroll-calculation/PayrollCalculationPage.jsx`.
- Đồng bộ hàm tính Thuế TNCN ở màn hình Tính Lương với đúng quy tắc đang hiển thị tại màn hình Dữ Liệu Kỳ Lương.

## Nguyên tắc dữ liệu
- Màn hình Tính Lương tiếp tục đọc bản ghi theo kỳ và nhân viên từ `payroll_period_insurance_tax_data`.
- Schema hiện tại của bảng này lưu dữ liệu đầu vào/điều chỉnh (bao gồm `taxable_income_override`, `has_commitment`, `commitment_validated`), không có cột lưu số Thuế TNCN đã tính. Vì vậy số thuế được tính từ bản ghi kỳ này theo cùng quy tắc của màn hình Dữ Liệu Kỳ Lương; không thể đọc trực tiếp một cột `tax_amount` chưa tồn tại.
- Cam kết thu nhập đã xác minh hợp lệ: Thuế TNCN = 0.
- Cơ Hữu: giữ nguyên hàm thuế lũy tiến 5 bậc.
- Nhóm còn lại: áp dụng khấu trừ 10% đúng như `taxEstimate` ở Dữ Liệu Kỳ Lương; bỏ ngưỡng 5.000.000 đang khiến hai màn hình lệch nhau.

## Không thay đổi
- Không sửa công thức Thu nhập chịu thuế.
- Không sửa dữ liệu Supabase, schema, migration, RLS hoặc cấu hình Realtime.
- Không thay đổi các cấu phần lương, BHXH, Công đoàn, khoản cộng/trừ hay thực lĩnh.

## Triển khai
Thay đúng file theo đường dẫn trong ZIP, commit/push lên GitHub Main và deploy Cloudflare Pages. Không chạy SQL/migration.

## Kiểm tra
- Đối chiếu cùng kỳ và cùng nhân viên ở hai màn hình.
- Kiểm tra VA104: số thuế ở Tính Lương phải bằng số thuế dự kiến tại Dữ Liệu Kỳ Lương.
- Kiểm tra Cơ Hữu để bảo đảm kết quả lũy tiến 5 bậc không đổi.
