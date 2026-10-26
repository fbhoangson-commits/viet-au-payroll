# V19 — Nhân Sự Master cuộn dọc

Chỉ gồm 2 file đã thay đổi:
- `src/features/employee-master/Page.jsx`
- `src/features/employee-master/styles/employee-master.css`

Thay đổi:
- Bỏ phân trang; danh sách render toàn bộ hồ sơ đã lọc.
- Vùng bảng có cuộn dọc (tối đa 68vh), header giữ cố định khi cuộn.
- Tìm kiếm và bộ lọc hiện có vẫn hoạt động.

Cách áp dụng: giải nén, chép đè đúng đường dẫn, commit/push GitHub và chờ Cloudflare Pages deploy.
Không cần chạy SQL. Không thay đổi dữ liệu Supabase.
