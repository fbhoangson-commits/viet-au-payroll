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
  const [showTaskManager, setShowTaskManager] = useState(false);

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

  const previewTasks = tasks.filter(task => task.status !== 'completed').slice(0, 3);

  return <section className="feature-page dashboard-page">
    <div className="dashboard-top-row">
      <div className="feature-heading dashboard-overview-heading">
        <div className="feature-heading-icon"><ClipboardList size={21}/></div>
        <div><div className="eyebrow">KHÔNG GIAN NGHIỆP VỤ</div><h2>Tổng quan</h2><p>Tổng hợp tình hình vận hành và các chỉ số theo kỳ lương.</p></div>
      </div>

      <aside className="todo-widget">
        <div className="todo-widget-header">
          <div className="todo-widget-heading"><div className="todo-widget-icon"><ListTodo size={16}/></div><div><h3>GHI CHÚ CỦA TÔI</h3><p>{counts.open} việc cần thực hiện{counts.overdue ? ` · ${counts.overdue} quá hạn` : ''}</p></div></div>
          <button className="todo-widget-add" onClick={openCreate} title="Thêm ghi chú" aria-label="Thêm ghi chú"><Plus size={16}/></button>
        </div>
        {error && <div className="todo-widget-error"><AlertCircle size={13}/><span>{error}</span><button onClick={loadTasks} title="Thử tải lại"><RefreshCw size={12}/></button></div>}
        {notice && <div className="todo-widget-notice">{notice}</div>}
        {loading ? <div className="todo-widget-empty"><Loader2 size={14} className="dashboard-spin"/> Đang tải ghi chú…</div>
          : previewTasks.length === 0 ? <div className="todo-widget-empty">{tasks.length ? 'Không còn việc nào cần thực hiện.' : 'Chưa có ghi chú. Thêm việc cần nhớ tại đây.'}</div>
          : <div className="todo-widget-list">{previewTasks.map(task => <div className={`todo-widget-item ${isOverdue(task) ? 'is-overdue' : ''}`} key={task.id}>
            <button className="todo-widget-check" onClick={() => toggleTask(task)} title="Đánh dấu hoàn thành"><Circle size={15}/></button>
            <button className="todo-widget-task" onClick={() => openEdit(task)} title="Mở ghi chú"><strong>{task.title}</strong><span>{task.due_date ? `Hạn ${formatDate(task.due_date)}` : priorityLabel(task.priority)}{isOverdue(task) ? ' · Quá hạn' : ''}</span></button>
            <button className="todo-widget-edit" onClick={() => openEdit(task)} title="Chỉnh sửa"><Edit3 size={13}/></button>
          </div>)}</div>}
        <div className="todo-widget-footer"><button onClick={() => { setFilter('open'); setShowTaskManager(v => !v); }}>{showTaskManager ? 'Thu gọn' : 'Xem tất cả ghi chú'}</button><span>{counts.done} hoàn thành</span></div>
        {showTaskManager && <div className="todo-manager">
          <div className="todo-manager-summary"><span>{counts.all} tổng</span><span>{counts.open} đang làm</span><span>{counts.overdue} quá hạn</span></div>
          <div className="todo-manager-toolbar"><div className="todo-manager-filters">{FILTERS.map(item => <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sắp xếp ghi chú"><option value="priority">Ưu tiên</option><option value="due_date">Ngày hết hạn</option><option value="created_at">Mới nhất</option></select></div>
          <div className="todo-manager-list">{visibleTasks.length ? visibleTasks.map(task => <div className={`todo-manager-item ${task.status === 'completed' ? 'is-completed' : ''}`} key={task.id}>
            <button onClick={() => toggleTask(task)} title={task.status === 'completed' ? 'Khôi phục' : 'Hoàn thành'}>{task.status === 'completed' ? <CheckCircle2 size={15}/> : <Circle size={15}/>}</button>
            <div><strong>{task.title}</strong><span>{task.due_date ? `Hạn ${formatDate(task.due_date)}` : priorityLabel(task.priority)}{isOverdue(task) ? ' · Quá hạn' : ''}</span></div>
            <button onClick={() => openEdit(task)} title="Sửa"><Edit3 size={13}/></button><button onClick={() => deleteTask(task)} title="Xóa"><Trash2 size={13}/></button>
          </div>) : <p className="todo-manager-empty">Không có ghi chú phù hợp.</p>}</div>
          {counts.done > 0 && <button className="todo-manager-completed" onClick={() => setShowCompleted(v => !v)}>{showCompleted ? 'Ẩn' : 'Hiện'} việc đã hoàn thành ({counts.done})</button>}
          {showCompleted && <div className="todo-manager-completed-list">{tasks.filter(t => t.status === 'completed').map(task => <div key={task.id}><span>{task.title}</span><button onClick={() => toggleTask(task)} title="Khôi phục"><RefreshCw size={12}/></button></div>)}</div>}
        </div>}
      </aside>
    </div>

    <div className="empty-workspace dashboard-empty-workspace">
      <div className="empty-illustration"><ShieldCheck size={32}/></div>
      <span className="status-pill">Chưa triển khai</span>
      <h3>Sẵn sàng xây dựng module này</h3>
      <p>Trang đang ở trạng thái khung trắng. Chưa tải dữ liệu, chưa chạy import và chưa thực hiện thay đổi trên cơ sở dữ liệu.</p>
      <div className="empty-checklist"><span><i/>Giao diện riêng cho tính năng</span><span><i/>Xử lý nghiệp vụ độc lập</span><span><i/>Dịch vụ dữ liệu tách biệt</span></div>
    </div>

    {modalOpen && <div className="todo-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setModalOpen(false); }}><section className="todo-modal" role="dialog" aria-modal="true" aria-labelledby="todo-modal-title"><header><div><h3 id="todo-modal-title">{editing ? 'Chỉnh sửa ghi chú' : 'Thêm ghi chú mới'}</h3><p>Lưu ghi chú vào danh sách cá nhân của bạn.</p></div><button onClick={() => setModalOpen(false)} disabled={saving} aria-label="Đóng"><X size={19}/></button></header><form onSubmit={saveTask}><label>Nội dung công việc <em>*</em><input autoFocus maxLength={180} required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="Nhập nội dung cần ghi nhớ"/></label><label>Ghi chú chi tiết<textarea rows={3} maxLength={2000} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} placeholder="Thông tin hoặc ghi chú bổ sung (không bắt buộc)"/></label><div className="todo-form-grid"><label>Ngày hết hạn<input type="date" value={form.due_date} onChange={e => setForm(v => ({ ...v, due_date: e.target.value }))}/></label><label>Mức độ ưu tiên<select value={form.priority} onChange={e => setForm(v => ({ ...v, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label></div>{error && <div className="todo-alert todo-alert-error"><AlertCircle size={15}/>{error}</div>}<footer><button type="button" className="todo-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Hủy</button><button type="submit" className="todo-primary" disabled={saving}>{saving ? <Loader2 size={15} className="dashboard-spin"/> : <Check size={15}/>} {editing ? 'Lưu thay đổi' : 'Thêm ghi chú'}</button></footer></form></section></div>}
  </section>;
}
