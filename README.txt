VA NHÂN SỰ MASTER – SỬA FORM THÊM NHÂN SỰ
Phạm vi: chỉ src/features/employee-master/Page.jsx

Thay đổi:
1. Mã Nhân Viên tự động sinh VAxxx theo mã VA lớn nhất hiện có + 1.
2. Mã Nhân Viên bị khóa, không cho nhập thủ công khi thêm mới hoặc chỉnh sửa.
3. Form Thêm Nhân Sự dùng toàn bộ trường đang có trong cấu hình Employee Master (các cột active), thay vì DEFAULT_FIELDS rút gọn.
4. Giữ nguyên cấu trúc lưu Employee Master, import/export, cấu hình cột và nghiệp vụ lương.
5. Không sửa PayrollCalculationPage.jsx, không cần SQL.

Lưu ý: mã được sinh phía giao diện dựa trên danh sách nhân sự đang tải. Nếu có nhiều người cùng lúc tạo hồ sơ, RLS/unique constraint hiện có của employees vẫn là lớp bảo vệ cuối cùng.
