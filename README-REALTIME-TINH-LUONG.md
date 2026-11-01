# PATCH: REALTIME TÍNH LƯƠNG + THU NHẬP CHỊU THUẾ

## File thay đổi
1. `src/features/payroll-calculation/PayrollCalculationPage.jsx`
   - Giữ bản sửa công thức Thu Nhập Chịu Thuế đã thống nhất.
   - Bổ sung Supabase Realtime listeners cho các bảng nguồn của kỳ lương.
   - Có polling dự phòng mỗi 15 giây trong trường hợp bảng chưa được bật Supabase Realtime.
   - Tự đồng bộ lại khi người dùng quay lại tab/cửa sổ ứng dụng.
2. `src/features/insurance-tax-data/Page.jsx`
   - Giữ bản sửa công thức: chỉ Hợp Đồng và Thỉnh Giảng trừ Khoản Trừ; Cơ Hữu giữ nguyên.

## Nghiệp vụ được giữ nguyên
- Cơ Hữu không thay đổi công thức.
- Hợp Đồng và Thỉnh Giảng:
  Lương cố định + Tổng Lương Tiết Dạy + Khoản cộng - Khoản trừ.
- Không chạy migration và không ghi dữ liệu Supabase.

## Cách áp dụng
- Giải nén ZIP.
- Chép đúng 2 file theo đúng đường dẫn vào mã nguồn hiện tại.
- Kiểm tra diff trước khi commit.
- Chạy `npm run build`.
- Deploy sau khi build thành công.

## Lưu ý về đồng bộ realtime
Ứng dụng đăng ký Supabase Realtime trên các bảng nguồn được liệt kê trong file mã nguồn. Để nhận sự kiện tức thời, các bảng này cần được bật trong Supabase Realtime publication (Database > Publications > supabase_realtime).
Nếu một bảng chưa được bật hoặc Realtime không phát sự kiện, polling dự phòng vẫn tải lại dữ liệu định kỳ 15 giây khi trang đang mở và hiển thị.
