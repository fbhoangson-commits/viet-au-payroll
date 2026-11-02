VA PAYROLL – PRODUCTION UI CLEANUP
Based on the latest uploaded source: viet-au-payroll-main (16).zip

Changed files:
- src/main.jsx
- src/styles.css

Changes:
- Removed the development notice banner ("Đang xây dựng nền tảng mới" / "CLEAN BASE").
- Removed the "GIAI ĐOẠN – Khởi tạo hệ thống" chip.
- Removed stale sidebar status ("Bộ khung sạch", "Chưa kết nối dữ liệu", "V9 CLEAN BASE").
- Removed the "MÔI TRƯỜNG MỚI" header chip.
- Removed the generic footer to reclaim screen space.
- Kept navigation, page titles, authentication, user profile, and all feature modules unchanged.
- Tightened top spacing without changing module-specific layouts or payroll logic.

Install:
Copy the two files to the same paths in the repository and push to GitHub.
No SQL migration required.

Validation:
The source ZIP was valid. The changed files were checked for remaining references to the removed development UI.
A Vite production build was not run because node_modules is not present in the uploaded source.
