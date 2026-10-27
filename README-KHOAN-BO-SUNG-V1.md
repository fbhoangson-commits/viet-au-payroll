# WEBAPP LƯƠNG VIỆT ÂU — KHOẢN BỔ SUNG V1

## Nội dung
- Thay trang placeholder `/payroll-adjustments` bằng giao diện nghiệp vụ Khoản Cộng Trừ và Tạm Ứng.
- Khoản Cộng Trừ: lọc theo kỳ, tìm kiếm, tổng cộng/trừ, thêm/sửa/xóa, áp dụng cho nhiều nhân sự trong danh sách đã chốt, nhập số tiền theo từng người hoặc chia đều tổng tiền.
- Tạm Ứng: tạo/sửa hồ sơ, xem tổng đã ghi nhận và số dư, lập kế hoạch thu hồi theo kỳ, xem lịch sử và hủy kế hoạch chưa ghi nhận.
- Thêm migration `supabase/migrations/20261027_payroll_adjustments_and_advances.sql`.

## Triển khai database
1. Kiểm tra project Supabase và migration hiện hành trước.
2. Chạy migration bổ sung trong môi trường kiểm thử trước khi production.
3. Không chạy migration phá hủy dữ liệu.

## Giới hạn quan trọng
- Kế hoạch thu hồi tạm ứng hiện được lưu độc lập; chưa tự động trừ vào phiếu lương hoặc cập nhật trạng thái `POSTED`.
- Không chỉnh sửa công thức tính lương trong bản này vì source hiện tại chưa cung cấp một luồng tính lương thực tế đã xác minh để tích hợp an toàn.
- RLS trong migration dùng mô hình quyền authenticated tương tự các migration module hiện tại. Cần rà soát quyền theo vai trò trước khi mở rộng người dùng thực tế.
- Cần chạy `npm install` và `npm run build` trong môi trường có thể tải dependencies; ở môi trường xử lý bản vá này, cài dependencies bị timeout nên chưa xác minh production build.
