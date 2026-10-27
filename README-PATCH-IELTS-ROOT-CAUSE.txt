BẢN VÁ IELTS — SỬA ĐÚNG NGUYÊN NHÂN NHẬN DIỆN NHÓM

Thay đúng 2 file:
- src/features/payroll-calculation/PayrollCalculationPage.jsx
- src/features/insurance-tax-data/Page.jsx

Nguyên nhân trong source mới nhất: hàm nhận diện nhóm ở bảng lương dùng `group.name || group.code`. Khi tên nhóm là IELTS nhưng mã nhóm là OTHER, mã OTHER bị bỏ qua; vì vậy nhóm không được phân loại là tiết dạy. Bản vá kết hợp cả tên và mã nhóm.

Đồng thời, trang Dữ Liệu BHXH/Thuế trước đó chỉ dò đơn giá theo khóa cột chính xác và ưu tiên dòng policy hiện hành; bản vá thêm dò khóa chuẩn hóa theo id/code/name/label. Không sửa công thức tính thuế, phân loại nhân sự, mức giảm trừ hay schema database.

Kiểm thử: cần chạy `npm run build` trong repository và đối chiếu kỳ lương có IELTS trên Supabase. Chưa thể xác minh dữ liệu production trong môi trường tạo bản vá này; không coi là đã xác nhận production.
