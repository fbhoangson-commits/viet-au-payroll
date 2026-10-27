PATCH: KHẮC PHỤC 3 CỘT NHÓM KHÁC KHÔNG ĐƯỢC TÍNH VÀO THU NHẬP

Nguồn: mã nguồn viet-au-payroll-main (1)(2).zip do Sơn cung cấp.

Phạm vi thay đổi (3 file):
1. src/features/teaching-attendance/Page.jsx
   - Tra cứu đơn giá theo ID/mã/tên/nhãn cột, có chuẩn hóa khóa.
   - Ưu tiên đơn giá của policy đang chọn; có fallback nếu kỳ không liên kết đúng phiên bản chính sách.
   - Dùng cùng cách dò đơn giá khi hiển thị, tính tổng và xác thực trước khi lưu số tiết.
2. src/features/payroll-calculation/PayrollCalculationPage.jsx
   - Nhận diện nhóm dựa trên cả code + name, tránh tên IELTS che khuất code OTHER.
3. src/features/insurance-tax-data/Page.jsx
   - Dùng cách dò đơn giá linh hoạt tương tự khi tính tiền tiết dạy và các cấu phần định mức.
   - Không thay đổi công thức thuế, phân loại nhân sự, mức giảm trừ hoặc tỷ lệ thuế.

Cài đặt:
- Sao lưu repository hiện tại.
- Giải nén vào thư mục gốc repository, ghi đè đúng 3 file trên.
- Chạy npm run build; chỉ triển khai nếu build thành công.
- Kiểm tra 3 cột thuộc nhóm Khác: Chấm Tiết hiển thị đơn giá/thành tiền; Bảng Lương hiển thị từng cột và Thành Tiền Tiết Dạy/Tổng Thu Nhập; Dữ Liệu BHXH & Thuế phản ánh tiền tiết dạy.

Giới hạn xác minh:
- Bản vá được chỉnh sửa trên mã nguồn ZIP được cung cấp trong phiên này.
- Không có kết nối trực tiếp Supabase production trong môi trường này, nên chưa thể xác minh dữ liệu thật.
- node_modules không có trong môi trường; chưa chạy được npm run build. Không tuyên bố đã build/test/deploy thành công.
