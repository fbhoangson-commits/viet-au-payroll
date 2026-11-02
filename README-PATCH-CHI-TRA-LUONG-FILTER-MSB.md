# VA-PAYROLL – Bộ lọc chi trả và xuất MSB

## File thay đổi
- `src/features/payroll-disbursements/Page.jsx`: thêm bộ lọc Nhóm / Phân nhóm / Bộ phận / Phân loại; các bộ lọc áp dụng đồng thời cho danh sách và Excel đang lọc; thêm xuất MSB.
- `src/features/payroll-disbursements/payroll-disbursements.css`: giao diện bộ lọc.
- `public/templates/T9-CH.xlsx`: template MSB gốc do nhà trường cung cấp, giữ cả hai sheet.
- `supabase/migrations/20261102_payroll_disbursement_employee_filters.sql`: bổ sung snapshot Nhóm / Phân nhóm và backfill dữ liệu hiện có.
- `package.json`: thêm ExcelJS để ghi dữ liệu vào workbook mẫu mà giữ định dạng/cấu trúc Excel.

## Cập nhật
1. Chạy migration SQL trong Supabase SQL Editor.
2. Chép các file trong ZIP vào đúng đường dẫn của repository.
3. Push GitHub; Cloudflare Pages cài dependency `exceljs` theo `package.json` khi build.
4. Mở Quản lý chi trả lương, chọn phiên bản đã duyệt, bấm Đối chiếu snapshot để cập nhật danh sách. Sau đó dùng Nhóm / Phân nhóm / Bộ phận / Phân loại và xuất Excel.

## Xuất MSB
- Dùng đúng workbook mẫu `T9-CH.xlsx`, giữ sheet hướng dẫn.
- Sheet thanh toán giữ cấu trúc 5 cột, độ rộng A-E theo file gốc; cột E ẩn; cố định hàng tiêu đề và bộ lọc.
- Chỉ xuất nhân sự thuộc nhóm Chuyển khoản, ngân hàng MSB, còn số dư phải trả; số tiền là số dư chưa thanh toán để tránh trả trùng phần đã ghi nhận.
- Các cột Nhóm / Phân nhóm / Bộ phận / Phân loại là bộ lọc giao diện và không được thêm vào mẫu MSB.

## Lưu ý
Chưa chạy build hoặc kết nối Supabase thật trong môi trường này. Cần kiểm tra sau deploy: dữ liệu nhóm/phân nhóm thực tế có thể nằm ở các key khác nhau trong `employees.custom_fields`; hiện đã hỗ trợ `employee_group`, `group`, `Nhóm`, `nhom` và `employee_subgroup`, `subgroup`, `sub_group`, `Phân nhóm`, `phan_nhom`.
