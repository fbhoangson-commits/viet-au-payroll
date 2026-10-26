import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, CheckCircle2, ChevronDown, Download, Eye, FilePlus2, Filter, History, LoaderCircle, Plus, RefreshCw, Search, ShieldAlert, UserRound, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createHistoryEvent, fetchHistoryEventTypes, fetchHistoryEvents, searchEmployees } from './services/employeeHistoryService.js';
import './styles/employee-history.css';

const FALLBACK_TYPES = [
  { code: 'ONBOARDING', label: 'Tiếp nhận nhân sự', display_order: 1 },
  { code: 'PERSONAL_INFO', label: 'Thay đổi thông tin cá nhân', display_order: 2 },
  { code: 'DEPARTMENT_CHANGE', label: 'Thay đổi bộ phận', display_order: 3 },
  { code: 'TRANSFER', label: 'Điều chuyển công tác', display_order: 4 },
  { code: 'POSITION_CHANGE', label: 'Thay đổi chức danh', display_order: 5 },
  { code: 'GROUP_CHANGE', label: 'Thay đổi nhóm nhân sự', display_order: 6 },
  { code: 'EMPLOYMENT_CLASSIFICATION', label: 'Thay đổi phân loại lao động', display_order: 7 },
  { code: 'STATUS_CHANGE', label: 'Thay đổi trạng thái làm việc', display_order: 8 },
  { code: 'CONTRACT_CHANGE', label: 'Thay đổi thông tin hợp đồng', display_order: 9 },
  { code: 'PAY_POLICY_CHANGE', label: 'Thay đổi thông tin lương/định mức', display_order: 10 },
  { code: 'OFFBOARDING', label: 'Nghỉ việc', display_order: 11 },
  { code: 'REHIRE', label: 'Tiếp nhận lại', display_order: 12 },
  { code: 'OTHER', label: 'Điều chỉnh thông tin khác', display_order: 13 },
];
const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 7)}-01`;
const employeeName = employee => employee?.full_name || employee?.name || employee?.employee_name || 'Chưa có tên';
const dateText = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('vi-VN') : '—';
const dateTimeText = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
const eventLabel = (type, types) => types.find(item => item.code === type)?.label || type || 'Sự kiện khác';
const errorText = error => error?.message || 'Đã xảy ra lỗi không xác định.';

function StatCard({ icon: Icon, label, value, tone = 'blue' }) {
  return <div className="eh-stat-card"><div className={`eh-stat-icon ${tone}`}><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

export default function Page() {
  const [events, setEvents] = useState([]);
  const [types, setTypes] = useState(FALLBACK_TYPES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ employee_code: '', event_type: 'OTHER', recorded_at: today(), effective_date: today(), description: '', before_value: '', after_value: '', decision_number: '', decision_date: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [history, eventTypes] = await Promise.all([fetchHistoryEvents(), fetchHistoryEventTypes().catch(() => null)]);
      setEvents(history);
      if (eventTypes?.length) setTypes(eventTypes);
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!modalOpen) return;
    let alive = true;
    setEmployeeLoading(true);
    searchEmployees(employeeQuery).then(rows => { if (alive) setEmployeeOptions(rows); }).catch(e => { if (alive) setFormError(errorText(e)); }).finally(() => { if (alive) setEmployeeLoading(false); });
    return () => { alive = false; };
  }, [modalOpen, employeeQuery]);

  const departments = useMemo(() => [...new Set(events.map(e => e.employee?.department).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), 'vi')), [events]);
  const actors = useMemo(() => [...new Set(events.map(e => e.actor_email).filter(Boolean))].sort(), [events]);
  const filtered = useMemo(() => events.filter(event => {
    const name = employeeName(event.employee);
    const searchHaystack = `${event.employee_code || ''} ${name} ${event.description || ''} ${event.decision_number || ''}`.toLocaleLowerCase('vi');
    const recordedDate = String(event.recorded_at || '').slice(0, 10);
    const inactive = /nghỉ việc|đã nghỉ|inactive|terminated/i.test(`${event.employee?.status || ''} ${event.employee?.employment_status || ''}`);
    return (!query || searchHaystack.includes(query.trim().toLocaleLowerCase('vi')))
      && (!typeFilter || event.event_type === typeFilter)
      && (!departmentFilter || event.employee?.department === departmentFilter)
      && (!statusFilter || (statusFilter === 'inactive' ? inactive : !inactive))
      && (!fromDate || recordedDate >= fromDate)
      && (!toDate || recordedDate <= toDate)
      && (!actorFilter || event.actor_email === actorFilter);
  }), [events, query, typeFilter, departmentFilter, statusFilter, fromDate, toDate, actorFilter]);

  const monthCount = events.filter(e => String(e.recorded_at || '').slice(0, 7) === today().slice(0, 7)).length;
  const effectiveMonthCount = events.filter(e => String(e.effective_date || '').slice(0, 7) === today().slice(0, 7) && /TRANSFER|DEPARTMENT_CHANGE|POSITION_CHANGE/i.test(e.event_type || '')).length;
  const clearFilters = () => { setQuery(''); setTypeFilter(''); setDepartmentFilter(''); setStatusFilter(''); setFromDate(''); setToDate(''); setActorFilter(''); };
  const setFormField = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const openCreate = () => { setForm({ employee_code: '', event_type: types[0]?.code || 'OTHER', recorded_at: today(), effective_date: today(), description: '', before_value: '', after_value: '', decision_number: '', decision_date: '', notes: '' }); setEmployeeQuery(''); setEmployeeOptions([]); setFormError(''); setModalOpen(true); };

  async function saveEvent(e) {
    e.preventDefault(); setFormError('');
    if (!form.employee_code) { setFormError('Vui lòng chọn nhân sự từ danh sách Mã Nhân Viên.'); return; }
    if (!form.event_type || !form.recorded_at || !form.description.trim()) { setFormError('Vui lòng nhập loại sự kiện, ngày ghi nhận và nội dung sự kiện.'); return; }
    setSaving(true);
    try {
      await createHistoryEvent(form);
      setModalOpen(false); setNotice('Đã ghi nhận sự kiện lịch sử nhân sự.');
      await load();
    } catch (e2) { setFormError(errorText(e2)); }
    finally { setSaving(false); }
  }

  function exportExcel() {
    const rows = filtered.map(event => ({
      'Ngày ghi nhận': dateTimeText(event.recorded_at),
      'Mã Nhân Viên': event.employee_code || '—',
      'Họ và tên': employeeName(event.employee),
      'Loại sự kiện': eventLabel(event.event_type, types),
      'Nội dung thay đổi': event.description || '—',
      'Giá trị trước': event.before_value || '—',
      'Giá trị sau': event.after_value || '—',
      'Ngày có hiệu lực': dateText(event.effective_date),
      'Số quyết định': event.decision_number || '—',
      'Ngày văn bản': dateText(event.decision_date),
      'Người ghi nhận': event.actor_email || '—',
      'Ghi chú': event.notes || '—',
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Lịch sử nhân sự');
    XLSX.writeFile(workbook, `Lich_su_nhan_su_${today()}.xlsx`);
  }

  return <section className="feature-page eh-page">
    <div className="feature-heading"><div className="feature-heading-icon"><History size={20}/></div><div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Lịch sử nhân sự</h2><p>Theo dõi quá trình thay đổi thông tin và nhóm nhân sự.</p></div></div>
    <div className="eh-toolbar"><div className="eh-toolbar-note"><Activity size={15}/><span>Lịch sử được liên kết với hồ sơ Nhân Sự Master bằng Mã Nhân Viên.</span></div><div className="eh-toolbar-actions"><button className="eh-button" onClick={exportExcel} disabled={!filtered.length}><Download size={15}/> Export Excel</button><button className="eh-button" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'eh-spin' : ''}/> Làm mới</button><button className="eh-button primary" onClick={openCreate}><Plus size={16}/> Thêm sự kiện</button></div></div>
    <div className="eh-stats"><StatCard icon={History} label="Tổng sự kiện" value={events.length} tone="blue"/><StatCard icon={CalendarDays} label="Sự kiện tháng này" value={monthCount} tone="green"/><StatCard icon={FilePlus2} label="Điều chuyển hiệu lực tháng này" value={effectiveMonthCount} tone="amber"/></div>
    {notice && <div className="eh-notice success"><CheckCircle2 size={16}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Đóng thông báo"><X size={15}/></button></div>}
    {error && <div className="eh-notice error"><ShieldAlert size={16}/><span><strong>Không thể tải lịch sử:</strong> {error}<br/>Kiểm tra migration và chính sách RLS của bảng employee_history_events.</span><button onClick={() => setError('')} aria-label="Đóng thông báo"><X size={15}/></button></div>}
    <div className="eh-filters">
      <label className="eh-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm Mã Nhân Viên, họ tên, nội dung, số quyết định..."/></label>
      <label className="eh-filter-select"><Filter size={14}/><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Tất cả sự kiện</option>{types.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select><ChevronDown size={13}/></label>
      <label className="eh-filter-select"><select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}><option value="">Tất cả bộ phận</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select><ChevronDown size={13}/></label>
      <label className="eh-filter-select"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Mọi trạng thái</option><option value="active">Đang làm việc</option><option value="inactive">Đã nghỉ việc</option></select><ChevronDown size={13}/></label>
      <label className="eh-date-filter"><span>Từ ngày</span><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}/></label>
      <label className="eh-date-filter"><span>Đến ngày</span><input type="date" value={toDate} onChange={e => setToDate(e.target.value)}/></label>
      {actors.length > 0 && <label className="eh-filter-select"><select value={actorFilter} onChange={e => setActorFilter(e.target.value)}><option value="">Mọi người ghi nhận</option>{actors.map(a => <option key={a} value={a}>{a}</option>)}</select><ChevronDown size={13}/></label>}
      <button className="eh-button subtle" onClick={clearFilters}>Xóa lọc</button>
    </div>
    <div className="eh-table-card"><div className="eh-table-scroll"><table className="eh-table"><thead><tr><th>Ngày ghi nhận</th><th>Mã Nhân Viên</th><th>Họ và tên</th><th>Loại sự kiện</th><th>Nội dung thay đổi</th><th>Ngày hiệu lực</th><th>Người ghi nhận</th><th>Thao tác</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={8} className="eh-empty"><LoaderCircle className="eh-spin" size={22}/>Đang tải dữ liệu lịch sử…</td></tr>
      : !filtered.length ? <tr><td colSpan={8} className="eh-empty"><History size={24}/><strong>Chưa có sự kiện lịch sử phù hợp</strong><span>Không tạo dữ liệu giả. Thêm sự kiện hoặc thay đổi bộ lọc để tiếp tục.</span></td></tr>
      : filtered.map(event => <tr key={event.id}><td className="eh-date-cell">{dateTimeText(event.recorded_at)}</td><td><span className="eh-code">{event.employee_code || '—'}</span></td><td><strong className="eh-employee-name">{employeeName(event.employee)}</strong></td><td><span className="eh-event-type">{eventLabel(event.event_type, types)}</span></td><td className="eh-description">{event.description || '—'}{event.before_value || event.after_value ? <small>{event.before_value || '—'} <span>→</span> {event.after_value || '—'}</small> : null}</td><td>{dateText(event.effective_date)}</td><td>{event.actor_email || '—'}</td><td><button className="eh-icon-button" title="Xem chi tiết" onClick={() => setDetail(event)}><Eye size={16}/></button></td></tr>)}
    </tbody></table></div><div className="eh-table-footer"><span>{filtered.length} sự kiện · Cuộn dọc để xem toàn bộ danh sách</span><button className="eh-button subtle" onClick={load} disabled={loading}><RefreshCw size={14}/> Tải lại</button></div></div>

    {modalOpen && <div className="eh-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setModalOpen(false); }}><form className="eh-modal" onSubmit={saveEvent}><div className="eh-modal-header"><div><span className="eyebrow">GHI NHẬN NGHIỆP VỤ</span><h3>Thêm sự kiện lịch sử</h3><p>Chọn nhân sự từ Nhân Sự Master; hệ thống không tự tạo hồ sơ nhân sự mới.</p></div><button type="button" className="eh-icon-button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Đóng"><X size={17}/></button></div>
      <div className="eh-modal-body"><label className="eh-form-field eh-full"><span>Nhân sự <b>*</b></span><div className="eh-employee-picker"><Search size={15}/><input value={employeeQuery} onChange={e => { setEmployeeQuery(e.target.value); setFormField('employee_code',''); }} placeholder="Tìm theo Mã Nhân Viên hoặc họ tên..." autoComplete="off"/><span>{employeeLoading ? <LoaderCircle size={15} className="eh-spin"/> : null}</span></div>{employeeQuery.trim() && !form.employee_code && <div className="eh-employee-options">{employeeOptions.map(employee => <button type="button" key={employee.id} onClick={() => { setFormField('employee_code', employee.employee_code); setEmployeeQuery(`${employee.employee_code} — ${employeeName(employee)}`); }}><strong>{employee.employee_code}</strong><span>{employeeName(employee)}</span><small>{employee.department || 'Chưa có bộ phận'}</small></button>)}{!employeeLoading && !employeeOptions.length && <div className="eh-no-options">Không tìm thấy nhân sự phù hợp.</div>}</div>}{form.employee_code && <div className="eh-selected-employee"><CheckCircle2 size={14}/> Đã chọn Mã Nhân Viên: <strong>{form.employee_code}</strong><button type="button" onClick={() => { setFormField('employee_code',''); setEmployeeQuery(''); }}>Đổi nhân sự</button></div>}</label>
      <label className="eh-form-field"><span>Loại sự kiện <b>*</b></span><select value={form.event_type} onChange={e => setFormField('event_type',e.target.value)}>{types.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select></label>
      <label className="eh-form-field"><span>Ngày ghi nhận <b>*</b></span><input type="date" value={form.recorded_at} onChange={e => setFormField('recorded_at',e.target.value)} required/></label>
      <label className="eh-form-field"><span>Ngày có hiệu lực</span><input type="date" value={form.effective_date} onChange={e => setFormField('effective_date',e.target.value)}/></label>
      <label className="eh-form-field"><span>Số quyết định / văn bản</span><input value={form.decision_number} onChange={e => setFormField('decision_number',e.target.value)} placeholder="Nhập số văn bản nếu có"/></label>
      <label className="eh-form-field"><span>Ngày văn bản</span><input type="date" value={form.decision_date} onChange={e => setFormField('decision_date',e.target.value)}/></label>
      <label className="eh-form-field eh-full"><span>Nội dung sự kiện <b>*</b></span><textarea value={form.description} onChange={e => setFormField('description',e.target.value)} rows={3} placeholder="Mô tả nội dung cần ghi nhận..." required/></label>
      <label className="eh-form-field"><span>Giá trị trước thay đổi</span><textarea value={form.before_value} onChange={e => setFormField('before_value',e.target.value)} rows={2} placeholder="Giá trị cũ nếu có"/></label>
      <label className="eh-form-field"><span>Giá trị sau thay đổi</span><textarea value={form.after_value} onChange={e => setFormField('after_value',e.target.value)} rows={2} placeholder="Giá trị mới nếu có"/></label>
      <label className="eh-form-field eh-full"><span>Ghi chú</span><textarea value={form.notes} onChange={e => setFormField('notes',e.target.value)} rows={2} placeholder="Ghi chú bổ sung (không bắt buộc)"/></label>
      {formError && <div className="eh-notice error eh-full"><ShieldAlert size={16}/><span>{formError}</span></div>}</div>
      <div className="eh-modal-footer"><button type="button" className="eh-button" onClick={() => setModalOpen(false)} disabled={saving}>Hủy</button><button type="submit" className="eh-button primary" disabled={saving}>{saving ? <><LoaderCircle size={15} className="eh-spin"/> Đang lưu…</> : <><Plus size={15}/> Lưu sự kiện</>}</button></div></form></div>}

    {detail && <div className="eh-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null); }}><div className="eh-modal eh-detail-modal"><div className="eh-modal-header"><div><span className="eyebrow">CHI TIẾT SỰ KIỆN</span><h3>{eventLabel(detail.event_type, types)}</h3><p>Mã sự kiện: {detail.id}</p></div><button className="eh-icon-button" onClick={() => setDetail(null)} aria-label="Đóng"><X size={17}/></button></div><div className="eh-detail-grid">{[['Mã Nhân Viên',detail.employee_code],['Họ và tên',employeeName(detail.employee)],['Ngày ghi nhận',dateTimeText(detail.recorded_at)],['Ngày có hiệu lực',dateText(detail.effective_date)],['Người ghi nhận',detail.actor_email],['Nguồn phát sinh',detail.source],['Số quyết định',detail.decision_number],['Ngày văn bản',dateText(detail.decision_date)]].map(([label,value]) => <div className="eh-detail-item" key={label}><span>{label}</span><strong>{value || '—'}</strong></div>)}<div className="eh-detail-item eh-full"><span>Nội dung sự kiện</span><strong>{detail.description || '—'}</strong></div><div className="eh-detail-item"><span>Giá trị trước thay đổi</span><strong>{detail.before_value || '—'}</strong></div><div className="eh-detail-item"><span>Giá trị sau thay đổi</span><strong>{detail.after_value || '—'}</strong></div><div className="eh-detail-item eh-full"><span>Ghi chú</span><strong>{detail.notes || '—'}</strong></div></div><div className="eh-modal-footer"><button className="eh-button" onClick={() => setDetail(null)}>Đóng</button></div></div></div>}
  </section>;
}
