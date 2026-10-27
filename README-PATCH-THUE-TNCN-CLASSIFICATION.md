BẢN VÁ: SỬA CÔNG THỨC THU NHẬP CHỊU THUẾ VÀ THUẾ TNCN

Phạm vi:
- Chỉ thay đổi src/features/insurance-tax-data/Page.jsx.
- Không sửa schema/database, không sửa menu hoặc module khác.

Quy tắc sau vá:
1. Cơ Hữu: giữ công thức hiện có của trang: tổng thu nhập theo cách tính hiện tại, trừ hỗ trợ, giảm trừ cá nhân, giảm trừ người phụ thuộc và phần BHXH NLĐ.
2. Hợp Đồng và Thỉnh Giảng: thu nhập tính thuế tự động = lương cố định + tiền tiết dạy/phụ đạo + khoản cộng; không trừ khoản trừ, hỗ trợ, giảm trừ cá nhân/người phụ thuộc hoặc BHXH.
3. Thuế Cơ Hữu: giữ biểu thuế lũy tiến 5 bậc hiện có.
4. Thuế Hợp Đồng/Thỉnh Giảng: chỉ tính 10% khi thu nhập tính thuế > 5.000.000 đồng; bằng hoặc thấp hơn 5.000.000 đồng thì 0.
5. Giá trị điều chỉnh thu nhập tính thuế đã nhập riêng cho kỳ vẫn được ưu tiên như hành vi hiện có.

Áp dụng: giải nén ZIP ở thư mục gốc repository, ghi đè đúng file trên. Chạy npm run build trước khi commit/push.
Lưu ý kiểm thử: npm run build chưa chạy được trong môi trường đóng gói vì dependencies (Vite) chưa được cài sẵn; cần chạy build trong môi trường dự án có dependencies.
