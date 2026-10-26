# WEBAPP LƯƠNG VIỆT ÂU — Patch Chính Sách Lương V1

## Phạm vi bản vá
- Dùng lại bảng `public.salary_policy_versions` hiện có; không tạo bảng chính sách thứ hai.
- Đổi nội dung hiển thị của màn hình hiện có thành **Chính Sách Lương** nhưng không đổi menu/router.
- Chuẩn hóa Mã Chính Sách Lương: bỏ khoảng trắng đầu/cuối, viết hoa, kiểm tra trùng mã trên giao diện.
- Kiểm tra ngày hiệu lực đến không được trước ngày hiệu lực từ.
- Thêm tìm kiếm theo mã, tên, trạng thái và ghi chú.
- Chặn xóa chính sách đã được tham chiếu bởi `public.salary_rate_rules`; khuyến nghị chuyển sang trạng thái ngừng sử dụng để giữ lịch sử.
- Thêm migration unique index không phân biệt chữ hoa/thường cho `salary_policy_versions.code`.
- Giữ nguyên liên kết định mức/quy tắc hiện tại qua `salary_rate_rules.policy_version_id`; tạo chính sách không tự sinh định mức hoặc tự thay đổi lương nhân sự.

## Tệp trong gói
- `scripts/apply_patch.py`: bản vá nhỏ, kiểm tra từng đoạn nguồn trước khi ghi. Chạy từ thư mục gốc repository.
- `CHANGES.diff`: diff để rà soát thủ công.
- `supabase/migrations/20261026_salary_policy_code_unique.sql`: migration bổ sung unique index.

## Cách áp dụng an toàn
1. Commit hoặc sao lưu repository hiện tại.
2. Đặt gói này ngoài hoặc trong thư mục repository, sau đó mở terminal tại thư mục gốc repository.
3. Chạy `python <đường-dẫn-gói>/scripts/apply_patch.py`.
4. Script chỉ sửa `src/main.jsx` nếu tất cả đoạn mã dự kiến đều khớp chính xác và xuất hiện đúng một lần. Nếu mã nguồn mới đã khác, script sẽ dừng mà không ghi file; khi đó cần đối chiếu thủ công với revision mới nhất, không thay toàn bộ file.
5. Rà soát `git diff` và chỉ giữ thay đổi thuộc Chính Sách Lương.
6. Kiểm tra mã trùng trước khi chạy migration. Migration sẽ dừng nếu phát hiện mã trùng (không phân biệt hoa/thường), không tự sửa/xóa dữ liệu.
7. Chạy build/test theo scripts của repository và kiểm tra quyền RLS bằng tài khoản được cấp quyền.

## Giới hạn kiểm thử
Gói được tạo dựa trên bản `main.jsx` hiện có trong Library. Không có quyền đọc raw bytes của ZIP repository mới nhất và không có kết nối trực tiếp tới GitHub/Supabase trong phiên này, vì vậy chưa thể xác nhận patch áp dụng được vào revision production hiện tại, chưa chạy build trên repository và chưa áp dụng migration lên database thật.

## Không thay đổi có chủ đích
Không thay đổi dữ liệu Nhân Sự Master, công thức tính lương, BHXH/thuế, cấu trúc kỳ lương, quyền/RLS, menu/router, hoặc các module khác. Chức năng lọc chính sách ngừng sử dụng khỏi danh sách chọn định mức chưa được thay đổi trong gói này vì cần kiểm tra mã nguồn mới nhất của `src/features/salary-rates/SalaryRatesModule.jsx` để không làm mất khả năng xem/sửa các định mức lịch sử.
