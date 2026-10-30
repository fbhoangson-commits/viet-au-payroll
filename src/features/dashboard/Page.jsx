import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarDays, Check, CheckCircle2, Circle, ClipboardList,
  Clock3, Edit3, ListTodo, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import './dashboard.css';

const PRIORITIES = [
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
];
const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'open', label: 'Chưa hoàn thành' },
  { value: 'done', label: 'Đã hoàn thành' },
  { value: 'overdue', label: 'Quá hạn' },
];
const EMPTY_FORM = { title: '', description: '', due_date: '', priority: 'normal' };
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const isOverdue = task => task.status !== 'completed' && Boolean(task.due_date) && task.due_date < todayLocal();
const formatDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : '';
const priorityLabel = value => PRIORITIES.find(item => item.value === value)?.label || 'Bình thường';

export default function Page() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('open');
  const [sort, setSort] = useState('priority');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!supabase) { setError('Supabase chưa được cấu hình. Không thể tải công việc.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase
      .from('payroll_user_tasks')
      .select('id,user_id,title,description,due_date,priority,status,created_at,updated_at,completed_at')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message.includes('payroll_user_tasks')
      ? 'Chưa tạo bảng payroll_user_tasks trên Supabase. Vui lòng chạy file SQL migration đi kèm bản vá.'
      : `Không tải được danh sách công việc: ${queryError.message}`);
    else setTasks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const counts = useMemo(() => ({
    all: tasks.length,
    open: tasks.filter(t => t.status !== 'completed').length,
    done: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks]);

  const visibleTasks = useMemo(() => {
    let rows = tasks.filter(task => {
      if (filter === 'open') return task.status !== 'completed';
      if (filter === 'done') return task.status === 'completed';
      if (filter === 'overdue') return isOverdue(task);
      return true;
    });
    const priorityRank = { high: 0, normal: 1, low: 2 };
    rows = [...rows].sort((a, b) => {
      if (sort === 'priority') return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
      if (sort === 'due_date') return String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return rows;
  }, [tasks, filter, sort]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true); };
  const openEdit = task => {
    setEditing(task);
    setForm({ title: task.title || '', description: task.description || '', due_date: task.due_date || '', priority: task.priority || 'normal' });
    setError(''); setModalOpen(true);
  };

  const saveTask = async event => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) { setError('Vui lòng nhập nội dung công việc.'); return; }
    setSaving(true); setError(''); setNotice('');
    const payload = {
      title,
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      priority: form.priority,
      updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from('payroll_user_tasks').update(payload).eq('id', editing.id).select().single()
      : await supabase.from('payroll_user_tasks').insert({ ...payload, status: 'pending' }).select().single();
    if (result.error) setError(`Không lưu được công việc: ${result.error.message}`);
    else {
      setTasks(old => editing ? old.map(t => t.id === editing.id ? result.data : t) : [result.data, ...old]);
      setModalOpen(false); setNotice(editing ? 'Đã cập nhật công việc.' : 'Đã thêm công việc.');
    }
    setSaving(false);
  };

  const toggleTask = async task => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;
    setError(''); setNotice('');
    const { data, error: updateError } = await supabase.from('payroll_user_tasks')
      .update({ status: nextStatus, completed_at: completedAt, updated_at: new Date().toISOString() })
      .eq('id', task.id).select().single();
    if (updateError) setError(`Không cập nhật được trạng thái: ${updateError.message}`);
    else setTasks(old => old.map(t => t.id === task.id ? data : t));
  };

  const deleteTask = async task => {
    if (!window.confirm(`Xóa công việc “${task.title}”? Thao tác này không thể hoàn tác.`)) return;
    setError(''); setNotice('');
    const { error: deleteError } = await supabase.from('payroll_user_tasks').delete().eq('id', task.id);
    if (deleteError) setError(`Không xóa được công việc: ${deleteError.message}`);
    else { setTasks(old => old.filter(t => t.id !== task.id)); setNotice('Đã xóa công việc.'); }
  };

  return <section className="feature-page dashboard-page">
    <div className="feature-heading"><div className="feature-heading-icon"><ClipboardList size={21}/></div><div><div className="eyebrow">WORKSPACE · PAYROLL</div><h2>Tổng quan</h2><p>Không gian làm việc cá nhân và theo dõi các công việc cần thực hiện.</p></div></div>

    <div className="dashboard-status-card"><div className="dashboard-status-icon"><ShieldCheck size={22}/></div><div><strong>Không gian làm việc VIỆT ÂU PAYROLL</strong><p>Các công việc được lưu theo tài khoản đăng nhập và đồng bộ qua Supabase.</p></div><button className="dashboard-refresh" onClick={loadTasks} disabled={loading}><RefreshCw size={14} className={loading ? 'dashboard-spin' : ''}/> Làm mới</button></div>

    <section className="todo-card">
      <div className="todo-header"><div className="todo-title-wrap"><div className="todo-icon"><ListTodo size={20}/></div><div><h3>CÔNG VIỆC CỦA TÔI</h3><p>Ghi nhớ, theo dõi và quản lý những công việc cần thực hiện.</p></div></div><button className="todo-primary" onClick={openCreate}><Plus size={16}/> Thêm công việc</button></div>

      <div className="todo-stats">
        <button className={`todo-stat ${filter === 'all' ? 'selected' : ''}`} onClick={() => setFilter('all')}><span>Tổng công việc</span><strong>{counts.all}</strong></button>
        <button className={`todo-stat todo-stat-open ${filter === 'open' ? 'selected' : ''}`} onClick={() => setFilter('open')}><span>Chưa hoàn thành</span><strong>{counts.open}</strong></button>
        <button className={`todo-stat todo-stat-done ${filter === 'done' ? 'selected' : ''}`} onClick={() => setFilter('done')}><span>Đã hoàn thành</span><strong>{counts.done}</strong></button>
        <button className={`todo-stat todo-stat-overdue ${filter === 'overdue' ? 'selected' : ''}`} onClick={() => setFilter('overdue')}><span>Quá hạn</span><strong>{counts.overdue}</strong></button>
      </div>

      <div className="todo-toolbar"><div className="todo-filters">{FILTERS.map(item => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}{item.value === 'overdue' && counts.overdue > 0 ? <b>{counts.overdue}</b> : null}</button>)}</div><label className="todo-sort">Sắp xếp<select value={sort} onChange={e => setSort(e.target.value)}><option value="priority">Mức độ ưu tiên</option><option value="due_date">Ngày hết hạn</option><option value="created_at">Ngày tạo mới nhất</option></select></label></div>

      {error && <div className="todo-alert todo-alert-error"><AlertCircle size={16}/><span>{error}</span></div>}
      {notice && <div className="todo-alert todo-alert-success"><CheckCircle2 size={16}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Đóng thông báo"><X size={14}/></button></div>}

      {loading ? <div className="todo-state"><Loader2 size={22} className="dashboard-spin"/>Đang tải công việc…</div>
        : visibleTasks.length === 0 ? <div className="todo-empty"><div><CheckCircle2 size={25}/></div><strong>{tasks.length === 0 ? 'Bạn chưa có công việc nào.' : 'Không có công việc phù hợp.'}</strong><p>{tasks.length === 0 ? 'Hãy thêm công việc đầu tiên để bắt đầu quản lý danh sách của mình.' : 'Thử chọn bộ lọc khác hoặc thêm công việc mới.'}</p>{tasks.length === 0 && <button className="todo-primary" onClick={openCreate}><Plus size={15}/> Thêm công việc đầu tiên</button>}</div>
        : <div className="todo-list">{visibleTasks.map(task => <article className={`todo-item ${task.status === 'completed' ? 'is-completed' : ''} ${isOverdue(task) ? 'is-overdue' : ''}`} key={task.id}>
          <button className={`todo-check ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => toggleTask(task)} aria-label={task.status === 'completed' ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}>{task.status === 'completed' ? <Check size={15}/> : <Circle size={19}/>}</button>
          <div className="todo-item-main"><div className="todo-item-title-row"><strong>{task.title}</strong><span className={`todo-priority priority-${task.priority || 'normal'}`}>{priorityLabel(task.priority)}</span>{isOverdue(task) && <span className="todo-overdue-label"><AlertCircle size={12}/> Quá hạn</span>}</div>{task.description && <p className="todo-description">{task.description}</p>}<div className="todo-meta">{task.due_date && <span className={isOverdue(task) ? 'overdue-date' : ''}><CalendarDays size={13}/> Hạn: {formatDate(task.due_date)}</span>}<span>{task.status === 'completed' ? <><CheckCircle2 size={13}/> Đã hoàn thành</> : <><Clock3 size={13}/> Chưa hoàn thành</>}</span></div></div>
          <div className="todo-actions"><button onClick={() => openEdit(task)} aria-label="Sửa công việc" title="Sửa"><Edit3 size={15}/></button><button className="delete" onClick={() => deleteTask(task)} aria-label="Xóa công việc" title="Xóa"><Trash2 size={15}/></button></div>
        </article>)}</div>}

      {counts.done > 0 && filter !== 'done' && <button className="todo-completed-toggle" onClick={() => setShowCompleted(v => !v)}>{showCompleted ? 'Ẩn' : 'Hiện'} danh sách đã hoàn thành ({counts.done})</button>}
      {showCompleted && filter !== 'done' && <div className="todo-completed-list">{tasks.filter(t => t.status === 'completed').map(task => <div key={task.id}><CheckCircle2 size={14}/><span>{task.title}</span><button onClick={() => toggleTask(task)} title="Khôi phục"><RefreshCw size={13}/></button></div>)}</div>}
    </section>

    {modalOpen && <div className="todo-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setModalOpen(false); }}><section className="todo-modal" role="dialog" aria-modal="true" aria-labelledby="todo-modal-title"><header><div><h3 id="todo-modal-title">{editing ? 'Chỉnh sửa công việc' : 'Thêm công việc mới'}</h3><p>Lưu công việc vào danh sách cá nhân của bạn.</p></div><button onClick={() => setModalOpen(false)} disabled={saving} aria-label="Đóng"><X size={19}/></button></header><form onSubmit={saveTask}><label>Nội dung công việc <em>*</em><input autoFocus maxLength={180} required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="Nhập nội dung cần thực hiện"/></label><label>Ghi chú chi tiết<textarea rows={3} maxLength={2000} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} placeholder="Thông tin hoặc ghi chú bổ sung (không bắt buộc)"/></label><div className="todo-form-grid"><label>Ngày hết hạn<input type="date" value={form.due_date} onChange={e => setForm(v => ({ ...v, due_date: e.target.value }))}/></label><label>Mức độ ưu tiên<select value={form.priority} onChange={e => setForm(v => ({ ...v, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label></div>{error && <div className="todo-alert todo-alert-error"><AlertCircle size={15}/>{error}</div>}<footer><button type="button" className="todo-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Hủy</button><button type="submit" className="todo-primary" disabled={saving}>{saving ? <Loader2 size={15} className="dashboard-spin"/> : <Check size={15}/>} {editing ? 'Lưu thay đổi' : 'Thêm công việc'}</button></footer></form></section></div>}
  </section>;
}
