# WEBAPP LƯƠNG VIỆT ÂU — CHẤM CÔNG NGÀY V5

## Phạm vi
Bản vá chỉ thay đổi:
- `src/features/daily-attendance/Page.jsx`
- `src/features/daily-attendance/daily-attendance.css`

Không có migration mới vì bản này không thay đổi schema/database.

## Sửa lỗi đồng bộ và số lượt chấm công
Supabase/PostgREST thường giới hạn một phản hồi truy vấn ở 1.000 dòng. V4 tải dữ liệu chấm công bằng một truy vấn duy nhất, khiến giao diện chỉ biết tối đa 1.000 dòng; số liệu và tập ô cần đồng bộ vì vậy không phản ánh đầy đủ dữ liệu kỳ.

V5 thêm `fetchAllRows()` để đọc tuần tự theo trang 500 dòng cho dữ liệu chấm công của kỳ. Sau khi tải đủ dữ liệu:
- Bộ đếm lượt đã lưu phản ánh toàn bộ dòng được đọc.
- Bản đồ ô đã chấm công biết các ô đã tồn tại trên toàn kỳ.
- Đồng bộ tiếp tục chia thành batch ghi 400 ô, tự chạy hết các batch.
- Các ô đã có dữ liệu được giữ nguyên; không dựa vào bộ lọc đang hiển thị.

Nếu nút vẫn báo lỗi sau khi deploy V5, cần lấy chính xác thông báo lỗi trong banner để xác định tiếp nguyên nhân backend/RLS/constraint; không thể kết luận chỉ từ ảnh giao diện.

## Cải thiện thẻ mã công
- Bỏ trường nhập mã HEX khỏi form và từng thẻ mã công.
- Giữ color picker nhỏ và tùy chọn chữ đậm.
- Chuyển thẻ mã công sang bố cục compact để tránh nhãn bị bóp hẹp/xuống dòng khó đọc.
- Không đổi mã công, tên, hệ số, hay ý nghĩa nghiệp vụ.
- Giữ màu chữ, không tô màu nền ô chấm công.

## Triển khai
1. Sao lưu hai file hiện tại.
2. Thay đúng hai file trong ZIP bằng các file tương ứng.
3. Chạy `npm run build` trên repository đầy đủ.
4. Deploy theo quy trình hiện tại.
5. Mở lại trang Chấm Công Ngày, bấm Làm mới và kiểm tra bộ đếm lượt đã lưu.
6. Thử Đồng bộ công chuẩn trên kỳ có hơn 1.000 ô cần điền; xác nhận tiến trình chạy qua nhiều batch và các ô thủ công không bị ghi đè.

## Kiểm tra đã thực hiện tại đây
- JSX được TypeScript transpile để kiểm tra cú pháp: 0 diagnostics.
- ZIP được tạo và kiểm tra tính toàn vẹn.
- Chưa chạy build toàn ứng dụng, chưa kết nối Supabase production và chưa kiểm thử ghi dữ liệu thật.
