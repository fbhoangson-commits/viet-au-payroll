# VA-BANK – Bổ sung Import / Export Excel

## File thay đổi
- `src/features/employee-bank/Page.jsx`
- `src/features/employee-bank/employee-bank.css`

Chép đè đúng 2 file này lên repository hiện tại. Không chạy lại migration Phase 1; không có thay đổi database.

## Chức năng
- **Tải mẫu:** tải file Excel mẫu có các cột: Mã nhân viên, Ngân hàng, Mã ngân hàng, Số tài khoản, Chủ tài khoản, Chi nhánh, Ghi chú.
- **Import Excel:** nhận `.xlsx` và `.xls`; đọc sheet đầu tiên; đối chiếu mã nhân viên; kiểm tra thiếu mã, nhân viên không tồn tại, mã trùng trong file, thiếu ngân hàng/số tài khoản/chủ tài khoản; hiển thị xem trước và chỉ xác nhận nhập các dòng hợp lệ.
- Nếu nhân viên đã có tài khoản, import cập nhật tài khoản hiện tại. Mọi dòng import đều chuyển về **Chờ xác minh**; trigger lịch sử của Phase 1 ghi nhận thay đổi.
- **Export Excel:** xuất danh sách toàn bộ nhân sự, bao gồm cả người chưa có tài khoản, thông tin ngân hàng và trạng thái xác minh.
- Chỉ người có quyền Super Admin hoặc Kế toán tiền lương nhìn thấy các nút thao tác.

## Cách sử dụng
1. Vào NHÂN SỰ → Tài khoản ngân hàng.
2. Chọn **Tải mẫu**, điền dữ liệu. Nên giữ nguyên tiêu đề cột và mã ngân hàng.
3. Chọn **Import Excel**, kiểm tra bảng xem trước và lỗi từng dòng.
4. Chọn xác nhận nhập. Dòng lỗi không được ghi vào hệ thống.
5. Chọn **Export Excel** để tải danh sách đối soát.

Mã ngân hàng hỗ trợ: `MSB`, `VCB`, `BIDV`, `MB`, `ACB`, `TCB`, `VIB`, `CTG`, `OTHER`. Với ngân hàng khác, điền tên ngân hàng ở cột Ngân hàng và `OTHER` ở cột Mã ngân hàng.

## Kiểm thử
Đã rà soát thay đổi ở mức mã nguồn và xác nhận gói chỉ chứa 2 file ứng dụng cùng README. Chưa chạy được Vite build trong môi trường đóng gói do source ZIP không có `package-lock.json` và môi trường không có bộ dependencies cài sẵn; cần xác nhận build sau khi push lên GitHub/Cloudflare.
