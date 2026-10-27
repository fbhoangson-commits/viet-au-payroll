# Quản Lý Kỳ Lương

Module riêng cho route `/payroll-periods`.

## Phạm vi
- Quản lý Kỳ Lương Tháng Cố Định: mỗi tháng một kỳ, chốt danh sách nhân sự hiện hành tại thời điểm tạo; không sao chép chấm công/kết quả kỳ trước.
- Quản lý Kỳ Phát Sinh: cấu hình cột dữ liệu độc lập theo kỳ; mặc định Ăn trưa, Điện thoại, Đồng phục.
- Import/Export Excel cho kỳ phát sinh theo Mã Nhân Viên.
- Dữ liệu lưu trong Supabase; không sử dụng LocalStorage.

## Triển khai
1. Chạy migration `supabase/migrations/20261027_payroll_periods_module.sql` trên Supabase sau khi rà soát môi trường hiện tại.
2. Build ứng dụng bằng `npm run build`.

Các bảng do module này sở hữu: `payroll_periods`, `payroll_period_employees`, `payroll_period_custom_columns`, `payroll_period_custom_values`.
