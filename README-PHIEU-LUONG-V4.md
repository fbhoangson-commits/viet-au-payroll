# Phiếu lương V4 – Barem thu nhập rõ ràng

## File thay đổi
- `viet-au-payroll-main/src/features/payslips/Page.jsx`

## Nội dung
- Sắp xếp phần A theo barem: (1) Lương cố định, (2) Lương tiết dạy, (3) Lương phụ đạo, (4) Lương dạy khác, (5) Khoản cộng, Tổng thu nhập.
- Chi tiết lương cố định: Lương cơ bản, Thâm niên, Thâm niên 2026, Phụ cấp.
- Chi tiết tiết dạy: Khối 10, Khối 11, Khối 12.
- Chi tiết phụ đạo: Chiều, Tối, Thứ 7, Chủ Nhật.
- Chi tiết dạy khác: Coi Thi, IELTS, Trợ Giảng.
- Các dòng dạy/tiết hiển thị số tiết, đơn giá, thành tiền.
- Bỏ dòng “Cấu phần tiết dạy (count)”; không dùng số lượng tiết làm khoản tiền.
- Giữ nguyên tổng thu nhập/thực lĩnh lấy từ snapshot; không tự tính lại lương.
- Giữ phần B khấu trừ, phần C phụ lục khoản cộng và phần D phụ lục khoản trừ.

## Giới hạn kiểm thử
Đã kiểm tra cú pháp JSX bằng TypeScript; chưa chạy build toàn dự án hoặc truy vấn Supabase trực tiếp. Các chi tiết không có trong dữ liệu nguồn sẽ được thể hiện là chưa có dữ liệu/ chưa đủ dữ liệu, không tự tạo số tiền để lấp đầy.
