# PATCH — Khoản Cộng Trừ theo mẫu Excel tháng 09/2026

## File thay đổi
- `src/features/payroll-adjustments/Page.jsx`: cập nhật Import/Export và biểu mẫu Khoản Cộng Trừ theo đúng 15 cột trong file `KHOAN_CONG_TRU_2026-09.xlsx`.
- `supabase/migrations/20261027_payroll_adjustments_excel_format.sql`: migration bổ sung các trường cần thiết cho dạng áp dụng, số lượng, đơn vị, đơn giá và thời hạn hiệu lực.

## Quy tắc được hỗ trợ
- Cột Excel: `MNV`, `Họ tên`, `Tên khoản`, `Loại khoản`, `Dạng áp dụng`, `Số lượng`, `Đơn vị tính`, `Đơn giá`, `Thành tiền`, `Số tiền`, `Kỳ áp dụng`, `Áp dụng từ`, `Áp dụng đến`, `Ghi chú`, `Trạng thái`.
- `Cố định`: áp dụng từ `Áp dụng từ` đến `Áp dụng đến`; nếu kỳ kết thúc trống thì không giới hạn.
- `Theo kỳ`: chỉ áp dụng ở `Kỳ áp dụng`.
- `Thành tiền` và `Số tiền` được kiểm tra khớp với `Số lượng × Đơn giá`; cho phép số lượng hoặc số tiền bằng 0 vì mẫu thực tế có dòng như vậy.
- `Đơn vị tính` có thể để trống, đúng với dữ liệu mẫu.
- Import chỉ tạo bản ghi mới, không sửa hoặc xóa bản ghi cũ; bỏ qua bản ghi trùng.
- `MNV` phải khớp Employee Master. Họ tên lấy từ Employee Master, không dùng tên trong Excel để tạo hồ sơ nhân sự.

## Triển khai
1. Sao lưu source hiện tại.
2. Chép `Page.jsx` đè đúng đường dẫn.
3. Kiểm tra migration trên môi trường phù hợp và chạy migration trước khi deploy.
4. Build, thử Import/Export bằng bản sao của workbook, rồi mới dùng dữ liệu thật.

Không bao gồm các file khác của ứng dụng. Chưa xác nhận build production hoặc migration trên Supabase thật.
