import { supabase } from '../../../shared/supabase.js';

export const HISTORY_TABLE = 'employee_history_events';
export const EVENT_TYPES_TABLE = 'employee_history_event_types';

function requireClient() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  return supabase;
}

export async function fetchHistoryEventTypes() {
  const client = requireClient();
  const { data, error } = await client
    .from(EVENT_TYPES_TABLE)
    .select('code,label,is_active,display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchHistoryEvents() {
  const client = requireClient();
  const { data, error } = await client
    .from(HISTORY_TABLE)
    .select('*')
    .order('recorded_at', { ascending: false });
  if (error) throw error;
  const events = data || [];
  const ids = [...new Set(events.map(row => row.employee_id).filter(Boolean))];
  const employeesById = new Map();
  if (ids.length) {
    // Chunk IDs to avoid overly long PostgREST URLs for large histories.
    for (let i = 0; i < ids.length; i += 100) {
      const { data: employees, error: employeeError } = await client
        .from('employees')
        .select('*')
        .in('id', ids.slice(i, i + 100));
      if (employeeError) throw employeeError;
      (employees || []).forEach(employee => employeesById.set(employee.id, employee));
    }
  }
  return events.map(event => ({ ...event, employee: employeesById.get(event.employee_id) || null }));
}

export async function searchEmployees(term = '') {
  const client = requireClient();
  const { data, error } = await client
    .from('employees')
    .select('*')
    .order('employee_code', { ascending: true, nullsFirst: false })
    .limit(1000);
  if (error) throw error;
  const query = term.trim().toLocaleLowerCase('vi');
  const rows = data || [];
  if (!query) return rows.slice(0, 30);
  return rows.filter(row => `${row.employee_code || ''} ${row.full_name || row.name || row.employee_name || ''}`.toLocaleLowerCase('vi').includes(query)).slice(0, 50);
}

export async function createHistoryEvent(values) {
  const client = requireClient();
  const { data: authResult, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authResult?.user) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  const employeeCode = String(values.employee_code || '').trim();
  if (!employeeCode) throw new Error('Vui lòng chọn nhân sự bằng Mã Nhân Viên.');

  // Resolve identity from the Employee Master at save time; never trust a typed name/code alone.
  const { data: employee, error: employeeError } = await client
    .from('employees')
    .select('*')
    .eq('employee_code', employeeCode)
    .maybeSingle();
  if (employeeError) throw employeeError;
  if (!employee) throw new Error(`Không tìm thấy Mã Nhân Viên ${employeeCode} trong Nhân Sự Master.`);

  const payload = {
    employee_id: employee.id,
    employee_code: employee.employee_code,
    event_type: values.event_type,
    recorded_at: values.recorded_at,
    effective_date: values.effective_date || null,
    description: String(values.description || '').trim(),
    before_value: String(values.before_value || '').trim() || null,
    after_value: String(values.after_value || '').trim() || null,
    decision_number: String(values.decision_number || '').trim() || null,
    decision_date: values.decision_date || null,
    notes: String(values.notes || '').trim() || null,
    source: 'manual',
    actor_auth_user_id: authResult.user.id,
    actor_email: authResult.user.email || null,
  };
  const { data, error } = await client.from(HISTORY_TABLE).insert(payload).select('*').single();
  if (error) throw error;
  return { ...data, employee };
}
