# PATCH – Thu nhập chịu thuế Hợp Đồng và Thỉnh Giảng

## Mã nguồn nền
`viet-au-payroll-main (6)(3).zip` – bản mã nguồn Sơn gửi sau khi khôi phục GitHub Main.

## Phạm vi thay đổi
Chỉ thay đổi 2 file:
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`
- `src/features/insurance-tax-data/Page.jsx`

## Nghiệp vụ
Đối với đúng hai phân loại **Hợp Đồng** và **Thỉnh Giảng**:

`Thu Nhập Chịu Thuế = max(0, Lương cố định + Tổng Lương Tiết Dạy + Khoản cộng - Khoản trừ)`

## Những phần được giữ nguyên
- Nhánh công thức **Cơ Hữu** trong Tính Lương được giữ nguyên.
- Nhánh công thức **Cơ Hữu** trong Dữ Liệu Bảo Hiểm và Thuế được giữ nguyên.
- Các phân loại khác không phải Hợp Đồng/Thỉnh Giảng tiếp tục dùng cách tính trước đó.
- Ưu tiên `taxable_income_override` thủ công vẫn giữ nguyên.
- Quy tắc loại trừ thuế, cam kết thu nhập, cách tính thuế suất, BHXH, hỗ trợ, lương thực lĩnh và các nghiệp vụ khác không thay đổi.
- Không có migration SQL, không ghi dữ liệu Supabase.

## Kiểm tra
- Hai file JSX đã được kiểm tra chuyển cú pháp bằng TypeScript transpile: PASS.
- Đối chiếu công thức ví dụ VA104:
  - Lương cố định: 12.275.000
  - Tổng Lương Tiết Dạy: 8.107.794
  - Khoản cộng: 400.000
  - Khoản trừ: 438.393
  - Kết quả: **20.344.401**
- Chưa chạy `npm run build`: ZIP nguồn không có `package-lock.json`; `npm ci` không thể chạy và `npm install` vượt thời gian chờ trong môi trường kiểm tra.
