# Fix lỗi màn hình trắng khi bấm Thêm khoản hỗ trợ

## Nguyên nhân đã xác định
UI ô tìm kiếm nhân sự đã sử dụng `employeePickerOpen` và `setEmployeePickerOpen`, nhưng state này chưa được khai báo trong component. Khi mở form, React render tới biến chưa khai báo và phát sinh `ReferenceError`, dẫn đến màn hình trắng.

## Sửa đổi
Bổ sung `useState(false)` cho `employeePickerOpen` trong nhóm state của form.
Không thay đổi nghiệp vụ lưu, database, tính thuế, liên kết kỳ lương hoặc các module khác.

## Áp dụng
Giải nén vào thư mục gốc dự án, giữ nguyên đường dẫn:
`src/features/employee-support/Page.jsx`

Sau đó chạy `npm run build`, deploy và thử lại nút Thêm khoản hỗ trợ.
