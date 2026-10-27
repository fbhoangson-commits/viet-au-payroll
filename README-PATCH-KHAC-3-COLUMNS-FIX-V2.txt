PATCH KHAC - 3 COLUMNS INCOME FIX V2
====================================

Applied against the latest uploaded source:
viet-au-payroll-main (2)(1).zip

Root cause addressed:
1) Payroll calculation previously selected the first salary_rate_values row matching an employee/group, even if that row did not contain the current column's rate. It could therefore mark rates missing / omit teaching pay for columns whose rates were stored in another row or policy version.
2) Insurance & Tax calculation previously collapsed salary_rate_values to one values object per employee/group. When multiple rows existed, one row overwrote another, causing some columns to disappear from income calculations.
3) The new resolver checks rate values column-by-column, prioritizes the active policy, and falls back only to rows for the same employee and group. It does not use another employee's rate row.

Files to overwrite:
- src/features/payroll-calculation/PayrollCalculationPage.jsx
- src/features/insurance-tax-data/Page.jsx

No changes to:
- teaching-attendance/Page.jsx
- tax formula / employee classification rules / relief amounts
- database schema or stored records
- other UI or business logic

Validation:
- JSX parsing check passed for both modified files using TypeScript transpilation.
- Full Vite build was not run because node_modules is absent in this environment.
- No live Supabase production records were accessible here, so production data behavior still needs confirmation after deployment.

After deploying, test one employee and the same payroll period with all three columns in group OTHER:
- verify each column's lesson count x rate contributes to teaching pay;
- verify total gross income increases by the combined amount;
- verify tax calculation still follows the existing classification-specific rules.
