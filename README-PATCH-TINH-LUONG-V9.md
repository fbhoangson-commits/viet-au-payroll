# PATCH TÍNH LƯƠNG V9 — Khôi phục nhóm Khác và tính tiền IELTS vào thu nhập chịu thuế

## File thay đổi
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`
  - Nhận diện nhóm định mức có tên chứa “Khác” (không chỉ tên đúng bằng “Khác”), để các cột trong nhóm này xuất hiện trong dữ liệu tiết dạy của bảng lương.
  - Khi không tìm thấy đơn giá theo phiên bản chính sách đang chọn, dò tiếp giá trị định mức đã lưu của đúng nhân sự/nhóm để tránh mất thành tiền của các tiết như IELTS.
- `src/features/insurance-tax-data/Page.jsx`
  - Khi tính thu nhập từ Chấm Công Tiết Dạy, nếu phiên bản chính sách không có dòng đơn giá tương ứng, dùng dòng định mức đã lưu của cùng nhân sự/nhóm làm dự phòng; áp dụng cả với cột IELTS thuộc nhóm Khác.

## Cách áp dụng
Giải nén ZIP tại thư mục gốc repository, cho phép ghi đè đúng hai file trên, sau đó chạy `npm run build`, kiểm tra bảng lương và Dữ Liệu Bảo Hiểm và Thuế ở cùng kỳ lương. Không có migration SQL trong patch này.

## Giới hạn kiểm thử
Patch được tạo dựa trên mã nguồn trong bản `PATCH-TINH-LUONG-8-MENU-V8`. Chưa chạy được build toàn dự án hoặc xác minh dữ liệu production/Supabase trong phiên này. Nếu dữ liệu định mức của nhân sự thực sự không tồn tại trong Supabase, cần kiểm tra bản ghi nguồn thay vì tự tạo số tiền.
