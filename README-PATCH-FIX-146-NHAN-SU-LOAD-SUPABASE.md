# Fix số nhân sự kỳ lương vẫn hiển thị 146

## Nguyên nhân kỹ thuật đã xác định
Các màn hình phía sau chưa dùng thống nhất một nguồn membership:
- Quản Lý Kỳ Lương ghi danh sách ở `payroll_period_employees`.
- Chấm Công Ngày và Chấm Công Tiết Dạy tải `payroll_period_employee_snapshots` trực tiếp, vì vậy các snapshot cũ có thể tiếp tục làm hiện 146 nhân sự.
- Khi lưu danh sách, code cũ không xác minh Supabase thực sự xóa được các dòng bị bỏ chọn; thao tác DELETE bị RLS chặn có thể không trả lỗi nhưng dữ liệu vẫn còn.

## Thay đổi trong bản vá
1. Quản Lý Kỳ Lương:
   - Sau khi xóa các nhân sự bị bỏ chọn, đọc lại danh sách trả về từ Supabase và xác minh số lượng/ID phải khớp lựa chọn.
   - Nếu RLS chặn DELETE hoặc dữ liệu không khớp, hiển thị lỗi rõ ràng thay vì báo lưu thành công.
   - Xác minh lại membership sau tất cả thao tác trước khi cập nhật `employee_count`.
2. Chấm Công Ngày:
   - Tải membership từ `payroll_period_employees`, chỉ hiển thị các snapshot có employee_id thuộc danh sách đã chốt.
3. Chấm Công Tiết Dạy:
   - Áp dụng cùng nguyên tắc membership cho cả lượt tải ban đầu và lượt tải khi đổi kỳ.
4. Tính Lương:
   - Giữ `payroll_period_employees` là nguồn danh sách nhân sự ưu tiên; snapshot chấm công không được dùng để khôi phục người đã bỏ khỏi kỳ.

## File
- `src/features/payroll-periods/Page.jsx`
- `src/features/daily-attendance/Page.jsx`
- `src/features/teaching-attendance/Page.jsx`
- `src/features/payroll-calculation/PayrollCalculationPage.jsx`

## Áp dụng và kiểm tra
- Thay đúng 4 file theo đường dẫn.
- Build và deploy.
- Mở Quản Lý Kỳ Lương, chỉnh kỳ, bỏ chọn nhân sự và lưu.
- Nếu Supabase không xóa được dòng, UI sẽ báo rõ; khi đó cần xử lý RLS policy DELETE cho `payroll_period_employees` (và snapshot nếu policy còn được dùng ở thao tác đồng bộ cũ).
- Refresh từng module. Chấm Công Ngày, Chấm Công Tiết Dạy, BHXH/Thuế và Tính Lương phải lấy danh sách từ membership của kỳ.
- Không tự chạy migration, không thay đổi Employee Master, không sửa snapshot kết quả Run đã tính/đã khóa.

## Kiểm tra trong môi trường thực hiện
- 4/4 file JSX đã qua TypeScript transpile, 0 lỗi cú pháp.
- Chưa chạy `npm run build` do môi trường không có dependencies.
- Không kết nối hoặc ghi dữ liệu Supabase thật.
