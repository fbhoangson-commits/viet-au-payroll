BẢN VÁ V4 – BÁO CÁO BHXH & THUẾ

File thay đổi:
src/features/insurance-tax-report/Page.jsx

Thay đổi:
- Đọc căn cứ đóng BHXH và các tỷ lệ NLĐ đóng từ Dữ Liệu Kỳ Lương (payroll_period_insurance_tax_data).
- Khi không có số tiền thành phần được lưu riêng, tính BHXH/BHYT/BHTN NLĐ theo căn cứ đóng × tỷ lệ tương ứng, chỉ khi nhân sự được đánh dấu tham gia BHXH và đủ dữ liệu căn cứ/tỷ lệ.
- Tổng căn cứ đóng BHXH chỉ cộng các nhân sự đang tham gia BHXH.
- Không ghi ngược dữ liệu, không sửa snapshot, không thay đổi công thức tính lương hoặc trạng thái duyệt.

Kiểm tra: TypeScript transpile JSX không có diagnostics. Chưa chạy build toàn dự án hoặc kiểm thử trên Supabase thật.
