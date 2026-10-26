import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Edit3, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import './salary-policy.css';

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = () => ({ code: '', name: '', effective_from: today(), effective_to: '', status: 'ACTIVE', notes: '' });
const statusLabels = { ACTIVE: 'Đang hoạt động', DRAFT: 'Bản nháp', RETIRED: 'Ngừng sử dụng' };
const dateLabel = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '—';

export default function Page() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Chưa cấu hình kết nối Supabase. Không thể đọc hoặc ghi dữ liệu chính sách.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('salary_policy_versions')
      .select('id, code, name, effective_from, effective_to, status, notes, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (queryError) {
      setError(`Không tải được chính sách lương: ${queryError.message}. Kiểm tra bảng salary_policy_versions và quyền RLS.`);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    return rows.filter(row => {
      const matchesSearch = !q || [row.code, row.name, row.notes].some(v => String(v || '').toLocaleLowerCase('vi').includes(q));
      return matchesSearch && (statusFilter === 'ALL' || row.status === statusFilter);
    });
  }, [rows, search, statusFilter]);

  const resetForm = () => { setForm(blankForm()); setEditingId(null); setMessage(''); };

  const submit = async event => {
    event.preventDefault();
    if (!supabase || saving) return;
    const code = form.code.trim().toLocaleUpperCase('vi');
    const name = form.name.trim();
    if (!code || !name) { setError('Vui lòng nhập Mã Chính Sách Lương và Tên chính sách.'); return; }
    if (form.effective_to && form.effective_to < form.effective_from) {
      setError('Ngày hiệu lực đến không được trước ngày hiệu lực từ.'); return;
    }
    setSaving(true); setError(''); setMessage('');
    const payload = {
      code, name,
      effective_from: form.effective_from,
      effective_to: form.effective_to || null,
      status: form.status,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString()
    };
    const result = editingId
      ? await supabase.from('salary_policy_versions').update(payload).eq('id', editingId)
      : await supabase.from('salary_policy_versions').insert(payload);
    if (result.error) {
      const duplicate = result.error.code === '23505';
      setError(duplicate
        ? `Mã chính sách “${code}” đã tồn tại. Vui lòng sử dụng mã khác.`
        : `Không lưu được chính sách: ${result.error.message}`);
      setSaving(false);
      return;
    }
    setMessage(editingId ? 'Đã cập nhật chính sách lương.' : 'Đã tạo chính sách lương.');
    resetForm();
    await load();
    setSaving(false);
  };

  const beginEdit = row => {
    setEditingId(row.id);
    setForm({
      code: row.code || '', name: row.name || '',
      effective_from: row.effective_from || today(),
      effective_to: row.effective_to || '',
      status: row.status || 'DRAFT', notes: row.notes || ''
    });
    setError(''); setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retirePolicy = async row => {
    if (!supabase || row.status === 'RETIRED') return;
    const confirmed = window.confirm(`Ngừng sử dụng chính sách “${row.code} · ${row.name}”? Định mức và dữ liệu lịch sử hiện có sẽ không bị xóa.`);
    if (!confirmed) return;
    setError(''); setMessage('');
    const { error: updateError } = await supabase.from('salary_policy_versions')
      .update({ status: 'RETIRED', updated_at: new Date().toISOString() }).eq('id', row.id);
    if (updateError) { setError(`Không thể ngừng sử dụng chính sách: ${updateError.message}`); return; }
    setMessage(`Đã ngừng sử dụng chính sách ${row.code}. Dữ liệu tham chiếu được giữ nguyên.`);
    await load();
  };

  return (
    <section className="salary-policy-page">
      <div className="sp-heading">
        <div className="sp-heading-icon"><ShieldCheck size={22}/></div>
        <div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Chính Sách Lương</h2>
          <p>Tạo mã chính sách làm cơ sở tham chiếu khi thiết lập Định Mức Lương.</p></div>
        <button type="button" className="sp-button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Làm mới</button>
      </div>

      <div className="sp-note"><ShieldCheck size={18}/><div><strong>Nguyên tắc dữ liệu</strong><p>Chính sách được lưu trên Supabase. Tạo hoặc sửa chính sách không tự tạo định mức, không tự thay đổi lương nhân sự và không xóa dữ liệu lịch sử.</p></div></div>

      {error && <div className="sp-alert error" role="alert"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError('')} aria-label="Đóng thông báo"><X size={15}/></button></div>}
      {message && <div className="sp-alert success" role="status"><CheckCircle2 size={17}/><span>{message}</span><button onClick={() => setMessage('')} aria-label="Đóng thông báo"><X size={15}/></button></div>}

      <section className="sp-card">
        <div className="sp-card-heading"><div><h3>{editingId ? 'Cập nhật chính sách' : 'Tạo Chính Sách Lương'}</h3><p>Mã chính sách là duy nhất và được dùng làm mã tham chiếu ổn định.</p></div></div>
        <form className="sp-form" onSubmit={submit}>
          <label>Mã Chính Sách Lương <span>*</span><input required maxLength={80} value={form.code} placeholder="VD: CSL-2026-2027" onChange={e => setForm(v => ({...v, code: e.target.value.toLocaleUpperCase('vi')}))}/></label>
          <label>Tên chính sách <span>*</span><input required maxLength={200} value={form.name} placeholder="VD: Chính sách lương năm học 2026–2027" onChange={e => setForm(v => ({...v, name: e.target.value}))}/></label>
          <label>Hiệu lực từ <span>*</span><input type="date" required value={form.effective_from} onChange={e => setForm(v => ({...v, effective_from: e.target.value}))}/></label>
          <label>Hiệu lực đến<input type="date" min={form.effective_from || undefined} value={form.effective_to} onChange={e => setForm(v => ({...v, effective_to: e.target.value}))}/></label>
          <label>Trạng thái<select value={form.status} onChange={e => setForm(v => ({...v, status: e.target.value}))}><option value="ACTIVE">Đang hoạt động</option><option value="DRAFT">Bản nháp</option><option value="RETIRED">Ngừng sử dụng</option></select></label>
          <label className="sp-wide">Ghi chú<textarea rows={2} maxLength={1000} value={form.notes} placeholder="Thông tin bổ sung (không bắt buộc)" onChange={e => setForm(v => ({...v, notes: e.target.value}))}/></label>
          <div className="sp-actions sp-wide"><button className="sp-button primary" type="submit" disabled={saving || !isSupabaseConfigured}><Plus size={15}/>{saving ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Tạo chính sách'}</button>{editingId && <button type="button" className="sp-button secondary" onClick={resetForm}>Hủy sửa</button>}</div>
        </form>
      </section>

      <section className="sp-card">
        <div className="sp-list-heading"><div><h3>Danh sách chính sách</h3><p>{rows.length} chính sách trong cơ sở dữ liệu</p></div></div>
        <div className="sp-toolbar"><div className="sp-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo mã, tên hoặc ghi chú…"/></div>
          <select aria-label="Lọc trạng thái" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="DRAFT">Bản nháp</option><option value="RETIRED">Ngừng sử dụng</option></select>
        </div>
        <div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Mã chính sách</th><th>Tên chính sách</th><th>Thời gian hiệu lực</th><th>Trạng thái</th><th>Ghi chú</th><th>Thao tác</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan="6" className="sp-empty">Đang tải dữ liệu từ Supabase…</td></tr> : filteredRows.length ? filteredRows.map(row => <tr key={row.id}>
            <td><strong>{row.code}</strong></td><td>{row.name}</td><td>{dateLabel(row.effective_from)} – {dateLabel(row.effective_to)}</td>
            <td><span className={`sp-status ${String(row.status || 'DRAFT').toLowerCase()}`}>{statusLabels[row.status] || row.status || 'Bản nháp'}</span></td><td className="sp-notes">{row.notes || '—'}</td>
            <td><div className="sp-row-actions"><button type="button" className="sp-icon-button" title="Sửa chính sách" aria-label={`Sửa ${row.code}`} onClick={() => beginEdit(row)}><Edit3 size={15}/></button>{row.status !== 'RETIRED' && <button type="button" className="sp-button small secondary" onClick={() => retirePolicy(row)}>Ngừng sử dụng</button>}</div></td>
          </tr>) : <tr><td colSpan="6" className="sp-empty">{error ? 'Không thể hiển thị dữ liệu cho đến khi kết nối được khắc phục.' : 'Chưa có chính sách phù hợp. Tạo chính sách đầu tiên bằng biểu mẫu phía trên.'}</td></tr>}</tbody>
        </table></div>
        <p className="sp-footnote">Chính sách đã sử dụng không có thao tác xóa tại màn hình này. Ngừng sử dụng sẽ giữ nguyên mã và các liên kết lịch sử.</p>
      </section>
    </section>
  );
}
