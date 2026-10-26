import { supabase } from '../../../shared/supabase.js';

export const EMPLOYEE_TABLE = 'employees';

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

export async function getCurrentUserProfile() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Phiên đăng nhập không hợp lệ.');
  // Do not assume app_users column names; try common auth mapping keys and let RLS remain authoritative.
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
