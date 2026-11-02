import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-backup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function gzip(bytes: Uint8Array) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const gasUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL') || '';
  const backupSecret = Deno.env.get('BACKUP_SECRET') || '';
  if (!supabaseUrl || !anonKey || !serviceKey || !gasUrl || !backupSecret) {
    return json(500, { error: 'BACKUP_ENVIRONMENT_NOT_CONFIGURED' });
  }

  let source: 'MANUAL' | 'SCHEDULED' = 'MANUAL';
  let actorId: string | null = null;
  const suppliedSecret = req.headers.get('x-backup-secret') || '';
  const isScheduled = suppliedSecret.length > 0 && suppliedSecret === backupSecret;
  if (isScheduled) {
    source = 'SCHEDULED';
  } else {
    const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!bearer) return json(401, { error: 'UNAUTHORIZED' });
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser(bearer);
    if (authError || !user) return json(401, { error: 'INVALID_SESSION' });
    const { data: admin, error: roleError } = await caller.rpc('system_is_admin');
    if (roleError || admin !== true) return json(403, { error: 'SUPER_ADMIN_REQUIRED' });
    actorId = user.id;
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let runId: string | null = null;
  try {
    const { data: run, error: insertError } = await admin.from('system_backup_runs')
      .insert({ status: 'RUNNING', source, created_by: actorId })
      .select('id').single();
    if (insertError) throw insertError;
    runId = run.id;

    const { data: snapshot, error: snapshotError } = await admin.rpc('system_export_database_snapshot');
    if (snapshotError) throw snapshotError;
    const raw = new TextEncoder().encode(JSON.stringify(snapshot));
    const compressed = await gzip(raw);
    const checksum = await sha256Hex(compressed);
    const month = new Date().toISOString().slice(0, 7);
    const fileName = `VIET-AU-PAYROLL-BACKUP-${month}.json.gz`;

    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_backup',
        token: backupSecret,
        file_name: fileName,
        content_base64: toBase64(compressed),
        checksum_sha256: checksum,
        source,
        created_at: new Date().toISOString(),
        table_count: snapshot?.table_count ?? null,
        row_count: snapshot?.row_count ?? null,
      }),
    });
    const gasText = await gasResponse.text();
    let gasResult: Record<string, unknown> = {};
    try { gasResult = JSON.parse(gasText); } catch { throw new Error(`GOOGLE_DRIVE_INVALID_RESPONSE_${gasResponse.status}`); }
    if (!gasResponse.ok || gasResult.success !== true) {
      throw new Error(String(gasResult.error || `GOOGLE_DRIVE_UPLOAD_FAILED_${gasResponse.status}`));
    }

    const { error: updateError } = await admin.from('system_backup_runs').update({
      status: 'SUCCESS', finished_at: new Date().toISOString(), file_name: fileName,
      drive_file_id: String(gasResult.file_id || ''), size_bytes: compressed.byteLength,
      checksum_sha256: checksum, table_count: snapshot?.table_count ?? null,
      row_count: snapshot?.row_count ?? null,
    }).eq('id', runId);
    if (updateError) throw updateError;

    if (actorId) {
      await admin.from('system_activity_logs').insert({
        actor_id: actorId, module: 'drive-backup', action: 'BACKUP_SUCCESS',
        entity_type: 'system_backup_runs', entity_id: runId,
        description: `Sao lưu ${fileName} lên Google Drive thành công`,
      });
    }
    return json(200, { success: true, run_id: runId, file_name: fileName, size_bytes: compressed.byteLength, checksum_sha256: checksum, table_count: snapshot?.table_count, row_count: snapshot?.row_count, drive_file_id: gasResult.file_id || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await admin.from('system_backup_runs').update({ status: 'FAILED', finished_at: new Date().toISOString(), error_message: message.slice(0, 1000) }).eq('id', runId);
    if (actorId && runId) {
      await admin.from('system_activity_logs').insert({ actor_id: actorId, module: 'drive-backup', action: 'BACKUP_FAILED', entity_type: 'system_backup_runs', entity_id: runId, description: `Sao lưu thất bại: ${message.slice(0, 500)}` });
    }
    console.error('system-drive-backup failed', error);
    return json(500, { error: message });
  }
});
