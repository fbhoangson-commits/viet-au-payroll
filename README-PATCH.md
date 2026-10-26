# Patch V16 — Employee Master import fallback

This patch contains only the changed file:
- `src/features/employee-master/Page.jsx`

Changes:
- Restricts import Headers sent as physical columns to an explicit allowlist. Unknown Headers such as `dependents_count` and `employee_group`, and future custom Headers, are stored in `custom_fields` JSONB.
- Strengthens schema-cache fallback so a rejected top-level field is moved to dynamic JSONB and the save is retried.
- Does not change authentication, RLS, other modules, or database schema.

Prerequisite: V15 migration must already have been applied so `employees.custom_fields` and `employees.custom_field_order` exist.

This patch was not tested against the live Supabase project. After deploying, verify the Cloudflare deployment uses the new commit before re-importing.
