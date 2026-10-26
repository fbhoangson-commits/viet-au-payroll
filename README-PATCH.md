# Patch V15 — Nhân Sự Master dynamic import fields

Files:
- `src/features/employee-master/Page.jsx` — import/export and dynamic fields UI.
- `supabase/migrations/20261026_employee_master_dynamic_fields.sql` — additive migration.

Important:
1. New Excel Headers are stored in `employees.custom_fields` (JSONB), not created as physical PostgreSQL columns. This avoids unsafe schema DDL from the browser and supports arbitrary new fields.
2. `custom_field_order` preserves the column order from the import workbook.
3. Apply the migration in Supabase SQL Editor before deploying this patch. It only adds two columns and does not delete or rename data.
4. The app retries an import when PostgREST explicitly reports an unmapped physical column, moving that field into dynamic JSONB data. If the database does not allow the migration or RLS denies the write, import will report the error.
5. This patch was not tested against the live Supabase schema. Build/deploy and import must be verified after applying the migration.
