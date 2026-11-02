# VA Payroll – Ghi nhận trả hàng loạt

## File thay đổi
- `src/features/payroll-disbursements/Page.jsx`
- `src/features/payroll-disbursements/payroll-disbursements.css`

## Cách cập nhật
Chép đúng 2 file theo đường dẫn trên vào repository hiện tại, commit/push để Cloudflare Pages deploy. Không có migration SQL mới.

## Cách sử dụng
1. Mở **Duyệt lương – Báo cáo → Quản lý chi trả lương**.
2. Chọn kỳ/phiên bản lương và các bộ lọc cần thiết.
3. Tick từng nhân sự hoặc tick ô đầu bảng để chọn toàn bộ nhân sự đang hiển thị còn số dư phải trả.
4. Chọn **Ghi nhận trả hàng loạt**.
5. Chọn hình thức thanh toán, ngày thanh toán; nhập mã chứng từ/ghi chú nếu có.
6. Xác nhận. Hệ thống ghi nhận thanh toán đủ số dư còn lại của từng nhân sự đã chọn.

Lưu ý:
- Chỉ các dòng còn số dư mới được chọn.
- Thao tác hàng loạt ghi nhận toàn bộ số dư còn lại của từng người; không dùng cho thanh toán một phần. Muốn thanh toán một phần, dùng nút **Ghi nhận trả** từng dòng.
- Không thay đổi số Thực lĩnh trong snapshot đã duyệt.
- Chưa kiểm thử kết nối với Supabase thật; cần kiểm tra trên môi trường staging trước khi thao tác dữ liệu thật.
