# Bản vá: Danh sách nhân sự theo Kỳ Lương và loại trừ BHXH/Thuế

## Yêu cầu xử lý
- Đổi bộ chọn nhân sự từ thẻ/card sang danh sách từng dòng, có tìm kiếm.
- Khi chốt 141 nhân sự, các module dùng danh sách kỳ phải cùng lấy đúng membership này.
- Nhân sự nghỉ/tạm nghỉ chế độ có thể vẫn nằm trong danh sách kỳ (nếu vẫn cần ghi nhận khoản lương), nhưng được đánh dấu loại khỏi BHXH và Thuế TNCN của riêng kỳ đó.

## Thay đổi
1. `src/features/payroll-periods/Page.jsx`
   - Hiển thị danh sách dòng: checkbox chọn tính lương, mã NV, họ tên, vị trí/bộ phận, checkbox Nghỉ/tạm nghỉ chế độ.
   - Khi lưu, đồng bộ membership giữa `payroll_period_employees` và `payroll_period_employee_snapshots`.
   - Thêm/bỏ nhân sự ở cả hai bảng; cập nhật số lượng nhân sự kỳ.
   - Lưu cờ loại trừ BHXH và Thuế theo kỳ.
2. `src/features/payroll-periods/payroll-periods.css`
   - Giao diện danh sách dạng dòng, dễ quét và thao tác.
3. `src/features/payroll-calculation/PayrollCalculationPage.jsx`
   - Nếu snapshot có `exclude_insurance=true`, không tính phần BHXH NLĐ và đơn vị.
   - Nếu `exclude_tax=true`, thu nhập tính thuế và thuế TNCN của nhân sự đó bằng 0 trong kỳ.
   - Không xóa khoản thu nhập/lương hoặc hồ sơ gốc.
4. `src/features/insurance-tax-data/Page.jsx`
   - Tab BHXH ẩn nhân sự được đánh dấu loại BHXH.
   - Tab Thuế TNCN ẩn nhân sự được đánh dấu loại thuế.
   - Tổng dự kiến BHXH/Thuế không cộng nhân sự đã loại.
5. `supabase/migrations/20261030_payroll_period_employee_scope_flags.sql`
   - Thêm `exclude_insurance`, `exclude_tax`, `period_note` vào hai bảng membership/snapshot.

## Đồng bộ các module
- Chấm Công ngày và Chấm Công Tiết Dạy đọc `payroll_period_employee_snapshots`; danh sách này được đồng bộ khi lưu kỳ.
- Tính Lương đọc `payroll_period_employees` trước, dùng flags theo snapshot kỳ.
- Dữ liệu chấm công và kết quả tính lương đã lưu không bị xóa khi thay đổi membership.
- Employee Master không bị sửa.

## Cách dùng
1. Chạy migration SQL trên Supabase trước khi deploy code.
2. Trong Quản Lý Kỳ Lương, chỉnh sửa kỳ và chọn/bỏ chọn nhân sự.
3. Với nhân sự nghỉ/tạm nghỉ chế độ, tick `Nghỉ / tạm nghỉ chế độ` để loại khỏi BHXH và Thuế TNCN trong kỳ.
4. Lưu kỳ; kiểm tra số lượng nhân sự và các module phía sau.

## Kiểm tra
- JSX transpile bằng TypeScript: 0 diagnostics cho 5 module được kiểm tra.
- Chưa chạy `npm run build` do môi trường làm việc không có `node_modules`.
- Chưa chạy migration hoặc ghi dữ liệu trên Supabase.
- Việc cập nhật membership qua hai bảng là hai lượt ghi Supabase từ giao diện; nếu một lượt ghi lỗi, UI báo lỗi cụ thể và cần kiểm tra hai bảng trước khi tiếp tục tính lương. Không có thao tác tự xóa dữ liệu chấm công.
