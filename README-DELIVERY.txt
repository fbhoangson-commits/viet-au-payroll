VIET AU PAYROLL – G2.1 MONTHLY GOOGLE DRIVE BACKUP

Only changed/new files from source ZIP12. Copy the contents into the project root, preserving the folder structure.
Detailed setup: G2.1-MONTHLY-DRIVE-BACKUP-SETUP.md

Files:
- src/features/drive-backup/Page.jsx
- src/features/drive-backup/drive-backup.css (new)
- src/features/drive-backup/README.md
- supabase/functions/system-drive-backup/index.ts (new)
- supabase/migrations/20261102_system_drive_backup_monthly.sql (new)
- supabase/apps-script/Code.gs (updated; preserves existing payroll email gateway)
- G2.1-MONTHLY-DRIVE-BACKUP-SETUP.md (new)

Important: Do not run the previous G2.1 SQL/function package. This is the replacement monthly Apps Script architecture.
