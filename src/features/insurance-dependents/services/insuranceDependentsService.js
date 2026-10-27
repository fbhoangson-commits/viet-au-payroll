import { supabase } from '../../../shared/supabase.js';

export const INSURANCE_TABLE = 'employee_insurance_profiles';
export const DEPENDENT_TABLE = 'employee_tax_dependents';
export const COMMITMENT_TABLE = 'employee_income_commitments';
export const UNION_TABLE = 'employee_union_profiles';
export const TAX_CONFIG_TABLE = 'payroll_tax_relief_config';

export async function fetchEmployeesForInsurance() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data, error } = await supabase.from('employees').select('*').order('employee_code', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}
export async function fetchModuleRows(table) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return data || [];
}
export async function saveModuleRow(table, payload) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { id, created_at, updated_at, ...safe } = payload;
  const { data, error } = await supabase.from(table).upsert(safe, { onConflict: 'employee_id' }).select('*').single();
  if (error) throw error;
  return data;
}
export async function saveDependentRows(employeeId, rows) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const valid = rows.filter(r => String(r.full_name || '').trim()).map(r => ({
    ...(r.id ? { id: r.id } : {}),
    employee_id: employeeId,
    full_name: String(r.full_name).trim(),
    relationship: r.relationship || null,
    date_of_birth: r.date_of_birth || null,
    tax_code: r.tax_code || null,
    identification_number: r.identification_number || null,
    effective_from: r.effective_from || null,
    effective_to: r.effective_to || null,
    status: r.status || 'Đang giảm trừ',
  }));
  const idsToKeep = valid.map(r => r.id).filter(Boolean);
  const existingResult = await supabase.from(DEPENDENT_TABLE).select('id').eq('employee_id', employeeId);
  if (existingResult.error) throw existingResult.error;
  const existingIds = (existingResult.data || []).map(r => r.id);
  const existingRows = valid.filter(r => r.id);
  const newRows = valid.filter(r => !r.id);
  if (existingRows.length) {
    const { error } = await supabase.from(DEPENDENT_TABLE).upsert(existingRows, { onConflict: 'id' });
    if (error) throw error;
  }
  if (newRows.length) {
    const { error } = await supabase.from(DEPENDENT_TABLE).insert(newRows);
    if (error) throw error;
  }
  const removedIds = existingIds.filter(id => !idsToKeep.includes(id));
  if (removedIds.length) {
    const { error } = await supabase.from(DEPENDENT_TABLE).delete().in('id', removedIds).eq('employee_id', employeeId);
    if (error) throw error;
  }
  return true;
}
export async function fetchTaxReliefConfig() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data, error } = await supabase.from(TAX_CONFIG_TABLE).select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data || { personal_relief_amount: 15500000, dependent_relief_amount: 6200000 };
}
export async function saveTaxReliefConfig(row) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const payload = { ...row, config_key: 'default' };
  const { data, error } = await supabase.from(TAX_CONFIG_TABLE).upsert(payload, { onConflict: 'config_key' }).select('*').single();
  if (error) throw error;
  return data;
}


export const SUPPORT_TABLE = 'employee_support_allowances';
export const SUPPORT_CONFIG_TABLE = 'payroll_support_allowance_columns';

export async function fetchSupportColumns() {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data, error } = await supabase.from(SUPPORT_CONFIG_TABLE).select('*').eq('config_key', 'default').maybeSingle();
  if (error) throw error;
  if (Array.isArray(data?.columns) && data.columns.length) return data.columns;
  return [
    { key: 'lunch', label: 'Ăn trưa', active: true, sort_order: 1 },
    { key: 'phone', label: 'Điện thoại', active: true, sort_order: 2 },
    { key: 'uniform', label: 'Đồng phục', active: true, sort_order: 3 },
  ];
}
export async function saveSupportColumns(columns) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const payload = { config_key: 'default', columns, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from(SUPPORT_CONFIG_TABLE).upsert(payload, { onConflict: 'config_key' }).select('*').single();
  if (error) throw error;
  return data.columns || columns;
}
export async function fetchSupportRows() {
  return fetchModuleRows(SUPPORT_TABLE);
}
export async function saveSupportRow(employeeId, amounts) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  const { data, error } = await supabase.from(SUPPORT_TABLE).upsert(
    { employee_id: employeeId, amounts: amounts || {}, updated_at: new Date().toISOString() },
    { onConflict: 'employee_id' }
  ).select('*').single();
  if (error) throw error;
  return data;
}
