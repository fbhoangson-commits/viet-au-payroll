PATCH IELTS LINK TO PAYROLL — V2

Scope: one file only
src/features/payroll-calculation/PayrollCalculationPage.jsx

Changes:
1. Recognize the salary-rate group code/name "OTHER" as a teaching-pay group, in addition to "Khác".
2. Exclude "OTHER" from fixed salary components so it is not misclassified as fixed pay.
3. Resolve a teaching rate by employee and rate group, preferring the selected policy version and falling back to that employee's saved rate rows if policy_version_id is missing or mismatched.
4. Resolve the rate by column id/code/name/label, including normalized key matching.
5. Does not edit insurance-tax-data/Page.jsx, does not change tax formulas, and does not change database schema.

Apply:
- Back up current source first.
- Extract at repository root and overwrite the matching file.
- Run npm run build before committing/deploying.
- Verify a known IELTS record in the same payroll period: lesson count × configured rate must appear in Thành Tiền Tiết Dạy and Tổng Thu Nhập.

Validation limitation:
- Full Vite build was not run in this environment because project dependencies are not installed here.
- Supabase production data was not queried, so confirm the selected period, employee ID, IELTS salary_rate_column_id, and configured salary_rate_values before payroll finalization.
