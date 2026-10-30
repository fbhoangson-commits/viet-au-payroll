-- Private storage for individual payroll PDF attachments.
-- Upload/download is performed only by the Edge Function and Apps Script service role.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payslip-email-pdfs', 'payslip-email-pdfs', false, 8388608, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['application/pdf'];

-- No anon/authenticated storage policies are created intentionally.
-- Service role bypasses RLS; employee/browser sessions cannot list or download payroll PDFs.
commit;
