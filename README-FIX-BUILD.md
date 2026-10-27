# Patch fix build - Bảo Hiểm và Người Phụ Thuộc

File thay đổi duy nhất:
- `src/features/insurance-dependents/Page.jsx`

Sửa lỗi cú pháp tại helper `masterInsuranceStatus`: bổ sung dấu `};` đóng hàm trước `parseNumber`, xử lý lỗi Vite `Unexpected "export"` tại dòng khai báo `export default function Page()`.

Không thay đổi module, schema, nghiệp vụ hoặc giao diện khác.

Sau khi chép đè file, chạy `npm install` (nếu môi trường chưa có dependencies) rồi `npm run build`.
