# Bản vá Phiếu lương V2 – chỉnh bố cục bản in

## File thay đổi
- `src/features/payslips/Page.jsx`

## Điều chỉnh
- Tách phần **Tổng hợp thu nhập** và **Các khoản khấu trừ** thành hai bảng/nhóm riêng.
- Hiển thị riêng tổng thu nhập, tổng khấu trừ và thực lĩnh.
- Bổ sung dòng nghiêng “(Bằng chữ: …)” ngay bên dưới thực lĩnh; chuyển số thực lĩnh đã lưu thành chữ, không dùng làm dữ liệu tính toán.
- Bỏ “Phiên bản” và “Trạng thái” khỏi phần thông tin cá nhân trên bản in.
- Phần cuối hiển thị liền mạch `NGƯỜI LẬP – PHẠM MINH TÂM` và `DUYỆT BẢNG LƯƠNG – NGUYỄN CƯỜNG`, không chừa khoảng trống ký tên.
- Bổ sung khung “XÁC NHẬN HỆ THỐNG” với thời gian in trên PDF.
- Bổ sung các phần phân tách tương ứng ở bản xem trước.

## Bảo toàn nghiệp vụ
- Không thay đổi công thức tính lương, snapshot, dữ liệu Supabase hoặc trạng thái duyệt.
- Phụ lục khoản cộng/trừ vẫn chỉ hiển thị các giao dịch thực tế tìm thấy; không tự tạo chi tiết để bù số liệu.
- Không sửa các module khác.

## Kiểm thử
- Đã chạy kiểm tra cú pháp JSX bằng TypeScript compiler thành công.
- Chưa chạy build toàn dự án hoặc kiểm thử trực tiếp với Supabase.
