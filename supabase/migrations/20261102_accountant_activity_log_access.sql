-- Allow payroll accountants to read the activity log, while keeping it read-only.
-- Super Admin retains existing access. No payroll tables or payroll policies are changed.
drop policy if exists system_activity_admin_read on public.system_activity_logs;
create policy system_activity_admin_read on public.system_activity_logs
for select to authenticated
using (
  public.system_is_admin()
  or public.system_has_role('PAYROLL_ACCOUNTANT')
);
-- Keep append-only behavior: this migration does not grant UPDATE or DELETE.
