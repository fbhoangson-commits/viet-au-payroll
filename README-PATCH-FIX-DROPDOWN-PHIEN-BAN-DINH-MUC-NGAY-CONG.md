# Fix dropdown Phiên Bản Định Mức – Định Mức Ngày Công

## Nguyên nhân
Trong `src/features/workday-norms/Page.jsx`, thứ tự destructuring kết quả `Promise.all()` bị lệch so với thứ tự truy vấn. Dữ liệu phiên bản định mức, giá trị phiên bản và nhóm định mức bị gán nhầm biến. Vì vậy `rateVersions` không nhận danh sách từ `salary_rate_versions`, khiến dropdown không có lựa chọn hợp lệ.

## Sửa đổi
Chỉ sửa thứ tự nhận kết quả:
- `rv` nhận kết quả truy vấn `salary_rate_versions`.
- `rvv` nhận kết quả truy vấn `salary_rate_version_values`.
- `g` nhận kết quả truy vấn `salary_rate_groups`.

Không thay đổi truy vấn, schema, dữ liệu, giao diện, nghiệp vụ tính lương hoặc các module khác.

## Áp dụng
Giải nén ZIP vào thư mục gốc dự án, giữ nguyên đường dẫn. Chỉ có một file mã nguồn được cập nhật.
Sau đó chạy `npm run build`, deploy và tải lại trang `/workday-norms`.
