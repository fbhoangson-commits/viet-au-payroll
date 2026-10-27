PATCH IELTS → BẢNG LƯƠNG (dựa trên mã nguồn mới nhất được gửi ngày 27/10/2026)

Phạm vi thay đổi duy nhất:
- src/features/payroll-calculation/PayrollCalculationPage.jsx

Nguyên nhân xác định từ mã nguồn:
1) Nhóm định mức có code/name OTHER chưa được nhận diện là nhóm tiết dạy.
2) Luồng đọc đơn giá dựa vào map đã lọc policy_version_id; phần dự phòng không bảo đảm khi bản ghi đơn giá có employee_code thay vì employee_id, policy_version_id trống/khác phiên bản, hoặc key trong values khác cách viết của mã/tên cột.

Bản vá:
- Nhận diện OTHER như nhóm tiết dạy và không cộng nhóm này vào lương cố định.
- Tìm đơn giá theo nhân sự + nhóm định mức, ưu tiên đúng phiên bản chính sách nhưng có dự phòng cho dòng đơn giá hiện có; hỗ trợ khóa cột theo id/code/name/label và so khớp chuẩn hóa.
- Không thay đổi src/features/insurance-tax-data/Page.jsx, công thức thuế, schema DB hoặc các module khác.

Cách áp dụng: giải nén tại thư mục gốc repository, chỉ ghi đè đúng file trên.

Kiểm chứng:
- Đã đối chiếu diff; chỉ thay đổi logic nhận diện nhóm và tra cứu đơn giá ở file tính lương.
- Chưa xác nhận được bản ghi thật trên Supabase trong môi trường này.
- Chưa chạy được npm run build vì môi trường không có Vite trong node_modules; npm install đã hết thời gian chờ. Vì vậy không tuyên bố build/production đã pass.

Sau khi áp dụng, kiểm tra kỳ có IELTS: số tiết IELTS × đơn giá cấu hình phải lên Thành Tiền Tiết Dạy và Tổng Thu Nhập. Nếu vẫn không lên, kiểm tra trạng thái dữ liệu và cảnh báo “Có tiết chưa khớp cấu hình” / “Thiếu đơn giá”; không sửa công thức thuế để xử lý lỗi liên kết.
