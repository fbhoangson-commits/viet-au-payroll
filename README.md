# VA Phase 1 – role-based system menu and activity log access

## Changed files
- `src/main.jsx`: resolves the signed-in user's system role through the existing `system_is_admin()` and `system_has_role(text)` RPCs. Super Admin retains every system menu item. Payroll Accountant sees only `Nhật ký hoạt động` under `Quản lý hệ thống`. Direct navigation to other system routes is redirected. Other application groups are unchanged.
- `supabase/migrations/20261102_accountant_activity_log_access.sql`: grants SELECT access to activity logs for Payroll Accountant as well as Super Admin. No UPDATE/DELETE access is added.

## Deploy
1. Replace `src/main.jsx` in GitHub with the file in this patch and deploy Cloudflare Pages.
2. Run the included SQL migration in Supabase SQL Editor.
3. Sign in as `tckt@thptvietau.edu.vn`: under `Quản lý hệ thống`, only `Nhật ký hoạt động` should appear. Directly opening `/user-permissions`, `/drive-backup`, `/data-restore`, `/email-settings`, `/connection-status`, or `/system-security` should redirect to `/activity-log`.
4. Sign in as `fbhoangson@gmail.com`: all system menu items should remain visible.

## Scope and safety
No changes to `PayrollCalculationPage.jsx`, payroll calculations, payroll tables, or existing payroll module code. The migration only replaces the SELECT policy on `system_activity_logs`; it does not grant log editing/deletion.

## Validation
Source-level review only. A full Vite build and live Supabase/Cloudflare verification have not been run in this environment.
