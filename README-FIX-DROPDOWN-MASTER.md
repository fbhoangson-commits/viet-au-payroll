# VA FIX – NHÂN SỰ MASTER: KHÔI PHỤC DROPDOWN

## Phạm vi
Chỉ thay đổi:
`src/features/employee-master/Page.jsx`

## Đã sửa
- Form Thêm Nhân Sự dùng đúng `fields`/cấu hình Master hiện hữu, không dùng danh sách cột hard-code để quyết định các trường hiển thị.
- Dropdown dùng `data_type = dropdown` và danh sách `options` của trường.
- Khi chưa có cấu hình cột trên Supabase, chỉ suy ra kiểu dữ liệu cho những trường thực sự đang tồn tại trong dữ liệu nhân sự.
- Các giá trị đang tồn tại của trường dropdown được đưa vào danh sách lựa chọn.
- Vẫn có `＋ Thêm mới...`; giá trị mới được lưu vào cấu hình dropdown trên Supabase.
- Export/Template/Import tiếp tục lấy `formFields` làm cấu trúc Master, không tự thêm 22 cột.
- Không sửa PayrollCalculationPage hoặc logic tính lương.
- Không có migration SQL trong gói này.

## Lưu ý
Không chạy bản ZIP trước đó đã biến Master thành 22 trường. Gói này dựa trên source `viet-au-payroll-main (8)(1).zip` mà Sơn cung cấp.
