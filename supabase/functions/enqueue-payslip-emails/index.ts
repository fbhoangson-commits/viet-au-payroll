import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const clean = (v: unknown) => String(v ?? '').trim();
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const official = (v: unknown) => ['APPROVED', 'LOCKED'].includes(clean(v).toUpperCase());
const getRows = (snapshot: any): any[] => {
  if (Array.isArray(snapshot)) return snapshot;
  for (const key of ['results', 'rows', 'employees', 'payroll_results', 'employee_results', 'details']) {
    if (Array.isArray(snapshot?.[key])) return snapshot[key];
  }
  return [];
};
const decodePdf = (value: string) => {
  const raw = value.replace(/^data:application\/pdf;base64,/i, '').replace(/\s/g, '');
  if (!raw || raw.length > 12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new Error('PDF_BASE64_INVALID');
  const binary = atob(raw);
  if (binary.length < 100 || binary.length > 8 * 1024 * 1024) throw new Error('PDF_SIZE_INVALID');
  if (!binary.startsWith('%PDF-')) throw new Error('PDF_SIGNATURE_INVALID');
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

Deno.serve(async (req) => {
  let cleanupAdmin: any = null;
  const uploadedPaths: string[] = [];
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authorization = req.headers.get('Authorization') ?? '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!supabaseUrl || !anonKey || !serviceKey || !token) return json(401, { error: 'UNAUTHORIZED' });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json(401, { error: 'INVALID_SESSION' });
    const { data: canOperate, error: permissionError } = await userClient.rpc('payroll_can_operate');
    if (permissionError || canOperate !== true) return json(403, { error: 'PAYROLL_PERMISSION_REQUIRED' });

    const payload = await req.json();
    const periodId = clean(payload?.period_id);
    const runId = clean(payload?.run_id);
    const batchId = clean(req.headers.get('x-idempotency-key') || payload?.batch_id);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!periodId || !runId || !/^[0-9a-f-]{36}$/i.test(batchId)) return json(400, { error: 'PERIOD_RUN_AND_UUID_IDEMPOTENCY_KEY_REQUIRED' });
    if (!items.length || items.length > 15) return json(400, { error: 'BATCH_SIZE_MUST_BE_1_TO_15' });

    // User-scoped reads enforce the same RLS access as the payroll Webapp.
    const { data: run, error: runError } = await userClient.from('payroll_runs')
      .select('id,payroll_period_id,status,input_snapshot,run_number')
      .eq('id', runId).eq('payroll_period_id', periodId).maybeSingle();
    if (runError || !run) return json(404, { error: 'PAYROLL_RUN_NOT_FOUND_OR_FORBIDDEN' });
    if (!official(run.status)) return json(409, { error: 'PAYROLL_RUN_MUST_BE_APPROVED_OR_LOCKED' });

    const snapshotRows = getRows(run.input_snapshot);
    const employeeIds = [...new Set(items.map((x: any) => clean(x?.employee_id)).filter(Boolean))];
    if (employeeIds.length !== items.length) return json(400, { error: 'INVALID_OR_DUPLICATE_EMPLOYEE_ID' });
    const snapshotById = new Map(snapshotRows.map((r: any) => [clean(r.employee_id || r.id), r]));
    if (employeeIds.some((id) => !snapshotById.has(id))) return json(400, { error: 'EMPLOYEE_NOT_IN_RUN_SNAPSHOT' });

    const { data: employees, error: employeeError } = await userClient.from('employees')
      .select('*').in('id', employeeIds);
    if (employeeError) return json(400, { error: 'EMPLOYEE_MASTER_READ_FAILED', detail: employeeError.message });
    const employeeById = new Map((employees ?? []).map((e: any) => [clean(e.id), e]));

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    cleanupAdmin = admin;
    const { data: existing, error: existingError } = await admin.from('payroll_email_queue')
      .select('employee_id,status').eq('batch_id', batchId);
    if (existingError) throw existingError;
    if ((existing ?? []).length) return json(409, { error: 'BATCH_ALREADY_EXISTS', existing });

    const { data: priorJobs, error: priorError } = await admin.from('payroll_email_queue')
      .select('employee_id,status').eq('payroll_run_id', runId).in('employee_id', employeeIds)
      .in('status', ['QUEUED', 'SENDING', 'SENT', 'NEEDS_REVIEW']);
    if (priorError) throw priorError;
    if ((priorJobs ?? []).length) return json(409, { error: 'EMPLOYEE_ALREADY_QUEUED_OR_SENT_FOR_THIS_RUN', existing: priorJobs });

    const queueRows: any[] = [];
    for (const item of items) {
      const employeeId = clean(item.employee_id);
      const snapshotRow: any = snapshotById.get(employeeId);
      const employee: any = employeeById.get(employeeId);
      if (!employee) throw new Error('EMPLOYEE_MASTER_RECORD_NOT_FOUND:' + employeeId);
      const email = clean(employee.email || employee.work_email || employee.email_work);
      if (!validEmail(email)) throw new Error('EMPLOYEE_EMAIL_INVALID:' + employeeId);
      const pdfBytes = decodePdf(clean(item.pdf_base64));
      const code = clean(snapshotRow.employee_code || snapshotRow.employee_code_snapshot || employee.employee_code || employee.code);
      const name = clean(snapshotRow.employee_name || snapshotRow.employee_name_snapshot || snapshotRow.full_name || snapshotRow.name || employee.full_name || employee.name || code);
      const fileName = clean(item.file_name || `PHIEU_LUONG_${code || employeeId}_${periodId}.pdf`).replace(/[\\/:*?"<>|]/g, '_').slice(0, 150);
      const storagePath = `${batchId}/${employeeId}.pdf`;
      const { error: uploadError } = await admin.storage.from('payslip-email-pdfs').upload(storagePath, pdfBytes, {
        contentType: 'application/pdf', upsert: false,
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);
      const periodLabel = clean(payload.period_label || periodId);
      const subject = `[VIỆT ÂU] Phiếu lương ${periodLabel}`;
      const htmlBody = `<p>Kính gửi Thầy/Cô <b>${name.replace(/[&<>"']/g, '')}</b>,</p><p>Phòng Tài chính – Trường THPT Việt Âu gửi Thầy/Cô phiếu lương ${periodLabel.replace(/[&<>"']/g, '')} đính kèm email này.</p><p>Trân trọng,<br><b>PHÒNG TÀI CHÍNH – TRƯỜNG THPT VIỆT ÂU</b></p>`;
      const textBody = `Kính gửi Thầy/Cô ${name},\n\nPhòng Tài chính – Trường THPT Việt Âu gửi Thầy/Cô phiếu lương ${periodLabel} đính kèm email này.\n\nTrân trọng.`;
      queueRows.push({
        batch_id: batchId, payroll_period_id: periodId, payroll_run_id: runId,
        employee_id: employeeId, employee_code: code, employee_name: name,
        recipient_email: email, period_label: periodLabel, subject, html_body: htmlBody,
        text_body: textBody, storage_bucket: 'payslip-email-pdfs', storage_path: storagePath,
        file_name: fileName, status: 'QUEUED', created_by: userData.user.id,
      });
    }
    const { data: jobs, error: insertError } = await admin.from('payroll_email_queue')
      .insert(queueRows).select('id,employee_id,employee_code,employee_name,recipient_email,status');
    if (insertError) {
      await admin.storage.from('payslip-email-pdfs').remove(uploadedPaths);
      throw insertError;
    }
    return json(200, { batch_id: batchId, queued: (jobs ?? []).length, jobs: jobs ?? [] });
  } catch (error) {
    if (cleanupAdmin && uploadedPaths.length) {
      try { await cleanupAdmin.storage.from('payslip-email-pdfs').remove(uploadedPaths); } catch (_) { /* retain original error */ }
    }
    console.error('enqueue-payslip-emails failed', error);
    return json(500, { error: 'ENQUEUE_FAILED', detail: error instanceof Error ? error.message : String(error) });
  }
});
