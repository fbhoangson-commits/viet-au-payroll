# VIỆT ÂU PAYROLL – Dashboard Tổng quan điều hành

## File thay đổi

1. `src/main.jsx`
   - Chuyển mục `TỔNG QUAN` thành nút điều hướng trực tiếp tới Dashboard.
   - Không hiển thị mũi tên xổ xuống/menu con cho riêng nhóm TỔNG QUAN.
   - Ẩn banner CLEAN BASE và thẻ giai đoạn khởi tạo chỉ trên Dashboard; các module khác giữ nguyên.

2. `src/features/dashboard/Page.jsx`
   - Thay khung trắng bằng Dashboard điều hành.
   - Đọc dữ liệu thật từ `employees`, `payroll_periods`, `payroll_period_employees`, `payroll_period_employee_snapshots`, `daily_attendance_records`, `teaching_attendance_records`, `payroll_runs`, `employee_insurance_profiles`.
   - Lọc dữ liệu chấm công/chấm tiết theo kỳ đang chọn; đọc các phiên bản lương gần nhất để tổng hợp chi phí và lịch sử.
   - Dùng `input_snapshot` của `payroll_runs` làm nguồn kết quả chính thức; không thực hiện tính lương lại.
   - Giữ tiện ích GHI CHÚ CỦA TÔI dạng nhỏ, tiếp tục sử dụng `payroll_user_tasks` đã có.

3. `src/features/dashboard/dashboard.css`
   - Bổ sung bố cục KPI, tiến độ nghiệp vụ, tài chính, lịch sử, cảnh báo và responsive.
   - Giữ nguyên style tiện ích ghi chú thu gọn.

## Database

- Không có SQL migration mới.
- Giữ nguyên bảng `payroll_user_tasks` và RLS đã triển khai trước đó.
- Dashboard chỉ SELECT; quyền đọc vẫn do Supabase RLS hiện hành quyết định.

## Cách cập nhật

Giải nén ZIP ở thư mục gốc repository, giữ nguyên đường dẫn và commit 3 file được cung cấp.

## Lưu ý về dữ liệu và cách diễn giải

- Nhân sự đang làm việc/đã nghỉ việc được phân loại từ các trường trạng thái trong Employee Master theo quy tắc hiện có của module Nhân sự.
- Trạng thái BHXH ưu tiên giá trị trong Employee Master; nếu chưa có giá trị hợp lệ mới dùng `employee_insurance_profiles`.
- Nhân sự có chấm công/chấm tiết là số nhân sự có ít nhất một bản ghi trong kỳ; đây KHÔNG được coi là bằng chứng đã hoàn tất toàn bộ chấm công/chấm tiết.
- Kết quả lương lấy từ `payroll_runs.input_snapshot`. Trạng thái duyệt/chốt là trạng thái cấp phiên bản lương (`payroll_runs.status`), không phải trạng thái duyệt riêng từng nhân sự.
- Cơ cấu thu nhập chỉ hiển thị các thành phần có trong snapshot; không tự chia nhỏ `teaching` thành tiết dạy/phụ đạo/dạy khác.
- Nguồn dữ liệu bị Supabase RLS từ chối hoặc chưa có bảng sẽ được hiển thị trong cảnh báo nguồn dữ liệu; không tạo số liệu giả.

## Kiểm tra

- Đã kiểm tra cú pháp JSX/JS của `src/main.jsx` và `src/features/dashboard/Page.jsx` bằng TypeScript transpile parser: không có diagnostic cú pháp.
- Chưa chạy được `npm run build`: repository không có `package-lock.json` và môi trường cài dependencies bị timeout.
- Chưa kết nối dự án Supabase production để kiểm thử số liệu, RLS và tương tác thực tế.
