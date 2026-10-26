import { supabase } from '../../../shared/supabase.js';

export const EMPLOYEE_TABLE = 'employees';
export const EMPLOYEE_COLUMN_CONFIG_TABLE = 'employee_master_column_configs';

export async function fetchEmployees() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data, error } = await supabase.from(EMPLOYEE_TABLE).select('*').order('employee_code', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function saveEmployee(values, id = null) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const payload = { ...values };
  delete payload.id;
  if (id) {
    const { data, error } = await supabase.from(EMPLOYEE_TABLE).update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from(EMPLOYEE_TABLE).insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function fetchEmployeeColumnConfigs() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data, error } = await supabase.from(EMPLOYEE_COLUMN_CONFIG_TABLE).select('*').order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveEmployeeColumnConfigs(rows) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  if (!rows.length) return [];
  const payload = rows.map((r, i) => ({
    field_key: String(r.field_key || '').trim(),
    label: String(r.label || r.field_key || '').trim(),
    data_type: r.data_type || 'text',
    show_in_list: Boolean(r.show_in_list),
    display_order: Number.isFinite(Number(r.display_order)) ? Number(r.display_order) : i,
    options: Array.isArray(r.options) ? r.options : [],
    is_system: Boolean(r.is_system),
    is_active: r.is_active !== false,
  }));
  const { data, error } = await supabase.from(EMPLOYEE_COLUMN_CONFIG_TABLE).upsert(payload, { onConflict: 'field_key' }).select('*');
  if (error) throw error;
  return data || [];
}

export async function getCurrentUserProfile() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Phiên đăng nhập không hợp lệ.');
  const attempts = [
    () => supabase.from('app_users').select('*').eq('id', auth.user.id).maybeSingle(),
    () => supabase.from('app_users').select('*').eq('auth_user_id', auth.user.id).maybeSingle(),
    () => supabase.from('app_users').select('*').eq('user_id', auth.user.id).maybeSingle(),
  ];
  for (const attempt of attempts) {
    const result = await attempt();
    if (!result.error && result.data) return { authUser: auth.user, appUser: result.data };
  }
  return { authUser: auth.user, appUser: null };
}
