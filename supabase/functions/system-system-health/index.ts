import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const gasUrl = Deno.env.get('GOOGLE_APPS_SCRIPT_URL') || '';
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!url || !anon || !service || !token) return reply(401, { error: 'UNAUTHORIZED' });

  try {
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser(token);
    if (authError || !user) return reply(401, { error: 'INVALID_SESSION' });
    const { data: isAdmin, error: roleError } = await caller.rpc('system_is_admin');
    if (roleError || isAdmin !== true) return reply(403, { error: 'SUPER_ADMIN_REQUIRED' });

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const checks: Record<string, { status: string; detail: string; checked_at: string }> = {};
    const stamp = () => new Date().toISOString();

    try {
      const { error } = await admin.from('system_backup_runs').select('id', { head: true, count: 'exact' });
      checks.database = { status: error ? 'ERROR' : 'OK', detail: error ? error.message : 'Kết nối PostgreSQL và bảng quản trị sao lưu hoạt động.', checked_at: stamp() };
    } catch (e) {
      checks.database = { status: 'ERROR', detail: e instanceof Error ? e.message : String(e), checked_at: stamp() };
    }

    try {
      const { data, error } = await admin.storage.listBuckets();
      checks.storage = { status: error ? 'ERROR' : 'OK', detail: error ? error.message : `Storage hoạt động · ${data?.length ?? 0} bucket.`, checked_at: stamp() };
    } catch (e) {
      checks.storage = { status: 'ERROR', detail: e instanceof Error ? e.message : String(e), checked_at: stamp() };
    }

    checks.auth = { status: 'OK', detail: `Đăng nhập hợp lệ · ${user.email || user.id}`, checked_at: stamp() };
    checks.authorization = { status: 'OK', detail: 'Đã xác minh vai trò SUPER_ADMIN ở phía máy chủ.', checked_at: stamp() };

    if (gasUrl) {
      try {
        const response = await fetch(gasUrl, { method: 'GET', redirect: 'follow' });
        const text = await response.text();
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(text); } catch { /* response shape checked below */ }
        const ok = response.ok && body.success === true && body.status === 'READY';
        checks.google_apps_script = { status: ok ? 'OK' : 'ERROR', detail: ok ? 'Web App Apps Script phản hồi READY.' : `Web App trả HTTP ${response.status} hoặc phản hồi không hợp lệ.`, checked_at: stamp() };
      } catch (e) {
        checks.google_apps_script = { status: 'ERROR', detail: e instanceof Error ? e.message : String(e), checked_at: stamp() };
      }
    } else {
      checks.google_apps_script = { status: 'NOT_CONFIGURED', detail: 'Chưa có GOOGLE_APPS_SCRIPT_URL trong Supabase Secrets.', checked_at: stamp() };
    }

    const { data: latest } = await admin.from('system_backup_runs')
      .select('created_at,finished_at,status,file_name,size_bytes,checksum_sha256')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    await admin.from('system_activity_logs').insert({
      actor_id: user.id, actor_email: user.email, module: 'connection-status',
      action: 'CHECK_CONNECTIONS', description: 'Kiểm tra trạng thái kết nối hệ thống.',
    });

    return reply(200, { success: true, checked_at: stamp(), checks, latest_backup: latest || null });
  } catch (e) {
    console.error('system-system-health', e);
    return reply(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
