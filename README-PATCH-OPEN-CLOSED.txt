VIET AU PAYROLL — PATCH MỞ/ĐÓNG KỲ LƯƠNG

Nguyên nhân xác nhận:
- UI dùng trạng thái OPEN và CLOSED.
- Check constraint hiện tại chỉ cho phép DRAFT, IMPORTED, CALCULATED, SUBMITTED, APPROVED, LOCKED.
- Vì vậy thao tác Mở kỳ/Đóng kỳ bị PostgreSQL từ chối.
- Hàm changeStatus không xóa thông báo cũ trước thao tác, nên thông báo thành công cũ có thể còn hiển thị khi thao tác mới lỗi.

File trong gói:
1. src/features/payroll-periods/Page.jsx
   - Chỉ sửa changeStatus để xóa thông báo cũ trước khi cập nhật trạng thái.
   - Không thay đổi logic/giao diện khác.
2. supabase/migrations/20261027_allow_payroll_period_open_closed.sql
   - Bổ sung OPEN và CLOSED vào danh sách trạng thái được phép, giữ nguyên 6 trạng thái hiện có.
   - Không sửa RLS, không xóa dữ liệu, không thay đổi các trạng thái nghiệp vụ hiện có.

Triển khai:
1. Sao lưu mã nguồn và database.
2. Chạy file SQL migration trong Supabase SQL Editor.
3. Thay đúng file Page.jsx trong repository bằng file trong gói.
4. Chạy npm run build, sau đó deploy theo quy trình hiện tại.
5. Kiểm tra mở kỳ DRAFT -> OPEN, đóng kỳ OPEN -> CLOSED, và mở lại CLOSED -> OPEN.

Lưu ý:
- Migration chưa được chạy trên Supabase của người dùng.
- Gói này chưa được kiểm thử build/deploy vì không có toàn bộ repository và package.json.
- Không áp dụng migration nếu schema hiện tại đã thay đổi; hãy kiểm tra lại constraint trước khi chạy.
