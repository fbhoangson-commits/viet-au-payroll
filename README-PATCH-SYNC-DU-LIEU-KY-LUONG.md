# PATCH – Đồng bộ dữ liệu Dữ Liệu Kỳ Lương → Tính Lương

## Mã nguồn gốc
`viet-au-payroll-main (8).zip` – snapshot `ed4f38645d947173e014fe13d60ea6b2d0e1f337`.

## Phạm vi
Chỉ thay đúng file:
`src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Thay đổi
- Giữ nguyên toàn bộ nguồn dữ liệu, phép tính, giao diện, danh sách bảng Realtime và chu kỳ polling 15 giây.
- Trước đây, khi một sự kiện Realtime hoặc polling đến trong lúc `load(true)` đang chạy, `refreshLatest()` thoát ngay và bỏ sự kiện đó.
- Nay đánh dấu `refreshPending` và thực hiện thêm một lần tải sau khi lần tải hiện tại hoàn tất. Các sự kiện liên tiếp được gộp thành một lần tải bù.
- Không thay đổi công thức Thuế TNCN, BHXH, Công đoàn, khoản cộng/trừ, tổng thu nhập hoặc thực lĩnh.
- Không có SQL/migration và không ghi dữ liệu Supabase.

## Triển khai
1. Giải nén ZIP vào thư mục gốc repository, giữ nguyên đường dẫn file.
2. Kiểm tra diff: chỉ có `PayrollCalculationPage.jsx` được thay đổi.
3. Build và kiểm thử trên môi trường dự án.
4. Commit/push GitHub Main và deploy Cloudflare Pages theo quy trình hiện tại.

## Kiểm thử nghiệm thu
1. Mở cùng kỳ lương ở Dữ Liệu Kỳ Lương và Tính Lương.
2. Chỉnh sửa một giá trị của VA104 tại Dữ Liệu Kỳ Lương và lưu.
3. Xác nhận Tính Lương tự tải lại, không cần F5; khi Realtime không hoạt động, polling dự phòng tối đa khoảng 15 giây.
4. Lặp lại thao tác khi Tính Lương đang tải dữ liệu để xác nhận lần thay đổi không bị bỏ qua.
5. Đối chiếu lại Thu nhập tính thuế và Thuế TNCN VA104 ở cả hai màn hình.

## Giới hạn xác minh
ZIP không có `node_modules`, nên chưa chạy được `vite build` tại môi trường đóng gói. Chưa thể xác nhận trạng thái Realtime Publication hoặc kết quả deploy Cloudflare từ mã nguồn offline.
