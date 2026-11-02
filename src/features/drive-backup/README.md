# Sao lưu Google Drive – G2.1

Phương án miễn phí theo mô hình OCEAN D&P: Supabase snapshot → Supabase Edge Function → Google Apps Script Web App → Google Drive của `tckt@thptvietau.edu.vn`.

- Lịch tự động: ngày 01 hằng tháng, khoảng 23:00 theo múi giờ dự án Apps Script.
- Có thể chạy thủ công từ giao diện Web Lương (chỉ Super Admin).
- Tệp nén gzip, tên `VIET-AU-PAYROLL-BACKUP-YYYY-MM.json.gz`, SHA-256 được kiểm tra trước khi lưu.
- Mỗi lần chạy lưu lịch sử trong `system_backup_runs`.
- Apps Script dùng DriveApp dưới quyền tài khoản triển khai, không cần Google Cloud OAuth/Client ID/Client Secret.

## Phạm vi snapshot

Bao gồm dữ liệu của các bảng `public`. Không bao gồm Auth users/identities, file nhị phân Supabase Storage, cấu hình hệ thống hoặc physical PostgreSQL dump. Đây là snapshot dữ liệu logic; chưa phải chức năng khôi phục tự động.

## Cấu hình

Xem `G2.1-MONTHLY-DRIVE-BACKUP-SETUP.md` ở thư mục gốc.
