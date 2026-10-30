# Bản vá điều chỉnh Báo cáo Định Mức Lương

## Phạm vi
Chỉ cập nhật phần dựng HTML khi xuất/in báo cáo định mức trong:
`src/features/salary-rates/Page.jsx`

## Thay đổi
1. Sắp xếp cột theo đúng thứ tự nhóm định mức (theo `sort_order` của nhóm), sau đó theo `display_order` của cột.
2. Báo cáo có 2 tầng tiêu đề: hàng nhóm định mức gộp ô theo số cột; hàng dưới là tên các cột thuộc nhóm tương ứng.
3. Giá trị rỗng/null và giá trị số bằng 0 hiển thị `—`.
4. Giá trị số được làm tròn đến hàng đơn vị và định dạng phân tách hàng nghìn theo `vi-VN`.
5. Phần thông tin đầu báo cáo dùng mã/tên chính sách và mã/tên phiên bản định mức, không in UUID chính sách.
6. Giữ khổ A4 ngang, bộ lọc nhân sự hiện hành và các cột đã chọn trước khi xuất.

## Phạm vi không thay đổi
- Không thay đổi dữ liệu, schema, migration, công thức tính lương, thao tác Import/Export dữ liệu.
- Không thay đổi giao diện màn hình quản lý định mức ngoài phần báo cáo PDF.
- Không sửa bất kỳ file nào khác.

## Cách áp dụng
Giải nén vào thư mục gốc dự án, giữ nguyên đường dẫn file. File `Page.jsx` thay thế đúng file cùng đường dẫn.

## Kiểm tra
Đã rà soát điều kiện định dạng: null/rỗng/0 => `—`; số => `toLocaleString('vi-VN', { maximumFractionDigits: 0 })`; nhóm và cột được sắp xếp trước khi tạo hai hàng tiêu đề.
Cần chạy `npm run build` trong môi trường dự án sau khi áp dụng.
