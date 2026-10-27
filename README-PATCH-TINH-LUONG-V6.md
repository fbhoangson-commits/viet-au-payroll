# PATCH TÍNH LƯƠNG V6

## Phạm vi
- Sửa `src/features/payroll-calculation/PayrollCalculationPage.jsx`.
- Thu Nhập Chịu Thuế và Thuế TNCN chỉ được thể hiện tại Tổng Quan Kỳ Lương, Bảo Hiểm & Phí Công Đoàn, Thuế TNCN và Tổng Hợp Lương.
- Không thêm hai cột thuế vào Lương Cố Định, Lương Tiết Dạy & Phụ Đạo, Khoản Cộng Trừ hoặc Nhân Sự Kỳ Lương.
- Bỏ cột `fixedComponentCount` khỏi bảng Lương Cố Định; giữ bốn cấu phần lương động và cột tổng.
- Điều chỉnh việc chọn phiên bản chính sách, nhóm lương cố định, khoản điều chỉnh, số người phụ thuộc, bảo hiểm được khấu trừ, phân loại và override để bám theo logic đang dùng ở `src/features/insurance-tax-data/Page.jsx`.
- Không ghi dữ liệu thuế mới vào Supabase và không thay đổi schema.

## Cài đặt
Giải nén vào thư mục gốc repository, cho phép ghi đè đúng file ở trên.

## Kiểm tra
Chưa xác minh build Vite hoàn chỉnh hoặc đối chiếu trực tiếp với Supabase production. Sau khi áp dụng, chọn cùng Kỳ Lương và so sánh từng nhân sự ở `/insurance-tax-data` với Tổng Quan, Bảo Hiểm & Phí Công Đoàn, Thuế TNCN và Tổng Hợp Lương. Không dùng để chốt lương cho đến khi số liệu đối chiếu khớp.
