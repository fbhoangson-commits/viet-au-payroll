WEBAPP LƯƠNG VIỆT ÂU — PATCH QUẢN LÝ KỲ LƯƠNG V5

PHẠM VI
- Thay src/features/payroll-periods/Page.jsx và payroll-periods.css.
- Cập nhật SQL migration schema alignment.
- Không thay đổi các module khác.

SỬA LỖI
1. Khi tạo mới, luôn INSERT trạng thái DRAFT để đáp ứng policy payroll_v1_periods_insert yêu cầu status = DRAFT. Không nới lỏng RLS. Người dùng có thể mở kỳ sau khi tạo bằng thao tác trạng thái hiện có.
2. Thêm trường bắt buộc Chính Sách Lương áp dụng, lấy từ salary_policy_versions. Khi tạo kỳ phải chọn chính sách ACTIVE; lưu ID vào salary_version_id. Khi sửa kỳ, trường chính sách bị khóa để tránh tự ý đổi chính sách kỳ đã tạo.
3. Giữ salary_version_id NOT NULL; migration không còn bỏ ràng buộc này. Không tự động thêm FK mới do chưa kiểm tra toàn bộ dữ liệu legacy.

CÀI ĐẶT
1. Sao lưu repository.
2. Giải nén ZIP ở thư mục gốc và ghi đè đúng hai file trong src/features/payroll-periods/.
3. Đọc SQL migration trước khi chạy. Migration thay đổi schema/index và tạo bảng phụ; hãy chạy trên môi trường kiểm thử trước. Không chạy lại các migration khác ngoài phạm vi.
4. npm run build; sau đó thử tạo kỳ với một chính sách ACTIVE, xác nhận trạng thái mới là DRAFT, rồi mở kỳ bằng thao tác hiện có.

GIỚI HẠN KIỂM THỬ
Gói được tạo từ source ZIP có trong cuộc trò chuyện. Chưa kết nối trực tiếp Supabase của người dùng nên chưa thể xác nhận migration hoặc thao tác INSERT trên database thật. Chưa xác nhận npm run build thành công.
