# Báo cáo BHXH & thuế

Module chỉ đọc dữ liệu từ Supabase, sử dụng `payroll_runs.input_snapshot.results` làm nguồn số liệu kỳ lương và bổ sung đối chiếu từ `payroll_period_insurance_tax_data`, `employee_insurance_profiles`, `employee_tax_dependents`, `employee_income_commitments`, `employee_union_profiles` và Employee Master khi các nguồn đọc được.

- Không tính lại lương, bảo hiểm hoặc thuế.
- Không ghi dữ liệu hoặc đổi trạng thái hồ sơ.
- Nếu nguồn không có chỉ tiêu, giao diện thể hiện `—`/chưa có dữ liệu.
- Các bảng phụ trợ là truy vấn tùy chọn; lỗi nguồn được ghi thành cảnh báo.
- Export Excel theo dữ liệu đã lọc trên giao diện.
