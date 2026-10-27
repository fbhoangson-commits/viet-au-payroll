import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import { Plus, RefreshCw, Search, Pencil, Trash2, X, Save, Wallet, ArrowDownUp, CalendarDays, AlertCircle, CheckCircle2, Coins, History } from 'lucide-react';
import './payroll-adjustments.css';

const ADJUSTMENTS = 'payroll_adjustments';
const ADVANCES = 'payroll_advances';
const RECOVERIES = 'payroll_advance_recoveries';
const money = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
const dateLabel = value => value ? new Date(`${String(value).slice(0,10)}T00:00:00`).toLocaleDateString('vi-VN') : '—';
const today = () => new Date().toISOString().slice(0,10);
const currentMonth = () => new Date().toISOString().slice(0,7);
const codeOf = e => String(e?.employee_code || e?.code || '').trim();
const nameOf = e => String(e?.employee_name || e?.full_name || e?.name || codeOf(e) || 'Chưa có tên');
const initialAdjustment = () => ({ period_id:'', employee_id:'', employee_ids:[], amount_mode:'PER_EMPLOYEE', kind:'ADD', name:'', amount:'', effective_date:today(), description:'', status:'ACTIVE' });
const initialAdvance = () => ({ employee_id:'', advance_date:today(), amount:'', description:'', start_period_id:'', status:'ACTIVE' });
const errorText = e => e?.message || String(e || 'Đã xảy ra lỗi.');

export default function Page() {
  const [tab, setTab] = useState('adjustments');
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [recoveries, setRecoveries] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [modal, setModal] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState(initialAdjustment());
  const [advanceForm, setAdvanceForm] = useState(initialAdvance());
  const [recoveryForm, setRecoveryForm] = useState({ advance_id:'', period_id:'', amount:'', notes:'' });
  const [recoveryFor, setRecoveryFor] = useState(null);

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) { setMessage({type:'error', text:'Chưa cấu hình Supabase. Không thể tải hoặc lưu dữ liệu.'}); setLoading(false); return; }
    setLoading(true); setMessage(null);
    try {
      const [p, e, a, av, r] = await Promise.all([
        supabase.from('payroll_periods').select('id,code,name,type,month,start_date,end_date,status,employee_count').order('month',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}),
        supabase.from('employees').select('*').order('employee_code',{ascending:true,nullsFirst:false}),
        supabase.from(ADJUSTMENTS).select('*').order('created_at',{ascending:false}),
        supabase.from(ADVANCES).select('*').order('advance_date',{ascending:false}),
        supabase.from(RECOVERIES).select('*').order('created_at',{ascending:false}),
      ]);
      for (const result of [p,e,a,av,r]) if (result.error) throw result.error;
      setPeriods(p.data || []); setEmployees(e.data || []); setAdjustments(a.data || []); setAdvances(av.data || []); setRecoveries(r.data || []);
      const fixed = (p.data || []).find(x => x.type === 'FIXED' && x.status !== 'CLOSED') || (p.data || []).find(x => x.type === 'FIXED');
      setPeriodId(old => old && (p.data || []).some(x => x.id === old) ? old : (fixed?.id || (p.data || [])[0]?.id || ''));
    } catch (e) { setMessage({type:'error',text:`Không tải được dữ liệu Supabase: ${errorText(e)}. Kiểm tra migration và quyền RLS.`}); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function loadSnapshots() {
      if (!periodId || !supabase) { setSnapshots([]); return; }
      const { data, error } = await supabase.from('payroll_period_employees').select('*').eq('period_id', periodId).order('employee_code');
      if (cancelled) return;
      if (error) { setSnapshots([]); setMessage({type:'error',text:`Không tải được danh sách nhân sự đã chốt của kỳ: ${error.message}`}); }
      else setSnapshots(data || []);
    }
    loadSnapshots(); return () => { cancelled = true; };
  }, [periodId]);

  const employeeById = useMemo(() => new Map(employees.map(e => [e.id,e])), [employees]);
  const snapshotById = useMemo(() => new Map(snapshots.map(e => [e.employee_id,e])), [snapshots]);
  const currentPeriod = periods.find(p => p.id === periodId);
  const periodLabel = p => p ? `${p.code || p.name}${p.month ? ` · ${p.month}` : ''}` : '—';
  const visibleAdjustments = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    return adjustments.filter(r => r.period_id === periodId)
      .filter(r => kindFilter === 'ALL' || r.kind === kindFilter)
      .filter(r => statusFilter === 'ALL' || r.status === statusFilter)
      .filter(r => !q || [r.employee_code,r.employee_name,r.name,r.description,r.code].some(v => String(v || '').toLocaleLowerCase('vi').includes(q)));
  }, [adjustments, periodId, kindFilter, statusFilter, search]);
  const visibleAdvances = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi');
    return advances.filter(r => !q || [r.employee_code,r.employee_name,r.code,r.description].some(v => String(v || '').toLocaleLowerCase('vi').includes(q)));
  }, [advances, search]);
  const totals = useMemo(() => visibleAdjustments.reduce((acc,r) => { if (r.status === 'ACTIVE') acc[r.kind === 'ADD' ? 'add' : 'deduct'] += Number(r.amount || 0); return acc; }, {add:0,deduct:0}), [visibleAdjustments]);
  const recoveryTotal = advanceId => recoveries.filter(r => r.advance_id === advanceId && r.status === 'POSTED').reduce((sum,r) => sum + Number(r.amount || 0),0);
  const plannedTotal = advanceId => recoveries.filter(r => r.advance_id === advanceId && r.status === 'PLANNED').reduce((sum,r) => sum + Number(r.amount || 0),0);
  const balance = advance => Math.max(0, Number(advance.amount || 0) - recoveryTotal(advance.id));
  const availableToPlan = advance => Math.max(0, balance(advance) - plannedTotal(advance.id));
  const eligibleEmployees = useMemo(() => snapshots.map(s => ({ id:s.employee_id, employee_code:s.employee_code, employee_name:s.employee_name, department:s.department, position:s.position })).filter(e => e.id), [snapshots]);
  const allEmployeeOptions = useMemo(() => employees.filter(e => e.id && codeOf(e)).map(e => ({id:e.id,employee_code:codeOf(e),employee_name:nameOf(e),status:e.status})), [employees]);

  const openAdjustment = row => {
    if (currentPeriod?.status === 'CLOSED') { setMessage({type:'error',text:'Kỳ lương đã đóng. Không thể thêm hoặc sửa khoản trong kỳ này.'}); return; }
    setAdjustmentForm(row ? { period_id:row.period_id, employee_id:row.employee_id, employee_ids:[row.employee_id], amount_mode:'PER_EMPLOYEE', kind:row.kind, name:row.name || '', amount:String(row.amount ?? ''), effective_date:row.effective_date || today(), description:row.description || '', status:row.status || 'ACTIVE', id:row.id } : {...initialAdjustment(),period_id:periodId});
    setModal('adjustment'); setMessage(null);
  };
  const openAdvance = row => {
    setAdvanceForm(row ? {employee_id:row.employee_id,advance_date:row.advance_date || today(),amount:String(row.amount ?? ''),description:row.description || '',start_period_id:row.start_period_id || '',status:row.status || 'ACTIVE',id:row.id} : initialAdvance());
    setModal('advance'); setMessage(null);
  };
  const saveAdjustment = async event => {
    event.preventDefault(); if (saving) return;
    const amount = Number(String(adjustmentForm.amount).replace(/\s/g,'').replace(/,/g,''));
    if (!adjustmentForm.period_id || !adjustmentForm.employee_id || !adjustmentForm.name.trim() || !Number.isFinite(amount) || amount <= 0) { setMessage({type:'error',text:'Vui lòng chọn kỳ lương, nhân sự, nhập tên khoản và số tiền lớn hơn 0.'}); return; }
    if (currentPeriod?.status === 'CLOSED') { setMessage({type:'error',text:'Kỳ lương đã đóng, không thể ghi dữ liệu.'}); return; }
    const selectedIds = adjustmentForm.id ? [adjustmentForm.employee_id] : [...new Set(adjustmentForm.employee_ids || [])];
    if (!selectedIds.length) { setMessage({type:'error',text:'Vui lòng chọn ít nhất một nhân sự thuộc danh sách đã chốt của kỳ lương.'}); return; }
    const selectedSnapshots = selectedIds.map(id => snapshotById.get(id)).filter(Boolean);
    if (selectedSnapshots.length !== selectedIds.length) { setMessage({type:'error',text:'Có nhân sự không thuộc danh sách đã chốt của kỳ đang chọn. Vui lòng tải lại dữ liệu.'}); return; }
    if (!adjustmentForm.id && adjustmentForm.amount_mode === 'SPLIT_TOTAL' && amount < selectedSnapshots.length) { setMessage({type:'error',text:'Tổng số tiền phải đủ để phân bổ ít nhất 1 đồng cho mỗi nhân sự.'}); return; }
    setSaving(true); setMessage(null);
    try {
      const userId = (await supabase.auth.getUser()).data?.user?.id || null;
      const payloads = selectedSnapshots.map((snap,index) => ({period_id:adjustmentForm.period_id,employee_id:snap.employee_id,employee_code:snap.employee_code,employee_name:snap.employee_name,kind:adjustmentForm.kind,name:adjustmentForm.name.trim(),amount:adjustmentForm.amount_mode==='SPLIT_TOTAL'&&!adjustmentForm.id ? Math.floor(amount/selectedSnapshots.length)+(index < amount%selectedSnapshots.length ? 1 : 0) : amount,effective_date:adjustmentForm.effective_date || today(),description:adjustmentForm.description.trim() || null,status:adjustmentForm.status,updated_at:new Date().toISOString(),...(!adjustmentForm.id?{created_by:userId}:{})}));
      if (adjustmentForm.id) {
        const result = await supabase.from(ADJUSTMENTS).update(payloads[0]).eq('id',adjustmentForm.id).select('*').single();
        if (result.error) throw result.error;
        setAdjustments(old => old.map(x => x.id === result.data.id ? result.data : x));
      } else {
        const result = await supabase.from(ADJUSTMENTS).insert(payloads).select('*');
        if (result.error) throw result.error;
        setAdjustments(old => [...(result.data || []),...old]);
      }
      setModal(null); setMessage({type:'success',text:adjustmentForm.id?'Đã cập nhật khoản cộng/trừ.':`Đã lưu khoản cộng/trừ cho ${selectedSnapshots.length} nhân sự lên Supabase.`});
    } catch(e) { setMessage({type:'error',text:`Không lưu được khoản cộng/trừ: ${errorText(e)}`}); }
    finally { setSaving(false); }
  };
  const deleteAdjustment = async row => {
    if (currentPeriod?.status === 'CLOSED') { setMessage({type:'error',text:'Kỳ lương đã đóng. Không thể xóa khoản.'}); return; }
    if (!window.confirm(`Xóa khoản “${row.name}” của ${row.employee_name}?`)) return;
    try { const {error} = await supabase.from(ADJUSTMENTS).delete().eq('id',row.id); if (error) throw error; setAdjustments(old=>old.filter(x=>x.id!==row.id)); setMessage({type:'success',text:'Đã xóa khoản cộng/trừ.'}); }
    catch(e) { setMessage({type:'error',text:`Không xóa được: ${errorText(e)}`}); }
  };
  const saveAdvance = async event => {
    event.preventDefault(); if (saving) return;
    const amount = Number(String(advanceForm.amount).replace(/\s/g,'').replace(/,/g,''));
    const employee = employeeById.get(advanceForm.employee_id);
    if (!employee || !Number.isFinite(amount) || amount <= 0 || !advanceForm.advance_date) { setMessage({type:'error',text:'Vui lòng chọn nhân sự, ngày tạm ứng và số tiền lớn hơn 0.'}); return; }
    if (advanceForm.id && recoveryTotal(advanceForm.id) > 0 && amount < recoveryTotal(advanceForm.id)) { setMessage({type:'error',text:'Số tiền tạm ứng không được nhỏ hơn tổng đã thu hồi.'}); return; }
    setSaving(true); setMessage(null);
    try {
      const payload = {employee_id:employee.id,employee_code:codeOf(employee),employee_name:nameOf(employee),advance_date:advanceForm.advance_date,amount,description:advanceForm.description.trim() || null,start_period_id:advanceForm.start_period_id || null,status:advanceForm.status,updated_at:new Date().toISOString()};
      const result = advanceForm.id ? await supabase.from(ADVANCES).update(payload).eq('id',advanceForm.id).select('*').single() : await supabase.from(ADVANCES).insert({...payload,created_by:(await supabase.auth.getUser()).data?.user?.id || null}).select('*').single();
      if (result.error) throw result.error;
      setAdvances(old=>advanceForm.id?old.map(x=>x.id===result.data.id?result.data:x):[result.data,...old]); setModal(null); setMessage({type:'success',text:'Đã lưu hồ sơ tạm ứng. Lưu ý: ghi nhận này chưa tự động khấu trừ vào lương.'});
    } catch(e) { setMessage({type:'error',text:`Không lưu được tạm ứng: ${errorText(e)}`}); }
    finally { setSaving(false); }
  };
  const saveRecovery = async event => {
    event.preventDefault(); if (saving) return;
    const advance = advances.find(a=>a.id===recoveryForm.advance_id); const period = periods.find(p=>p.id===recoveryForm.period_id); const amount = Number(String(recoveryForm.amount).replace(/\s/g,'').replace(/,/g,''));
    if (!advance || !period || !Number.isFinite(amount) || amount <= 0) { setMessage({type:'error',text:'Vui lòng chọn khoản tạm ứng, kỳ lương và số tiền thu hồi hợp lệ.'}); return; }
    if (period.status === 'CLOSED') { setMessage({type:'error',text:'Kỳ lương đã đóng. Không thể lập kế hoạch thu hồi cho kỳ này.'}); return; }
    if (amount > availableToPlan(advance)) { setMessage({type:'error',text:`Số tiền vượt số dư chưa được phân bổ (${money(availableToPlan(advance))}).`}); return; }
    setSaving(true); setMessage(null);
    try {
      const payload={advance_id:advance.id,period_id:period.id,employee_id:advance.employee_id,employee_code:advance.employee_code,employee_name:advance.employee_name,amount,status:'PLANNED',notes:recoveryForm.notes.trim()||null,updated_at:new Date().toISOString()};
      const {data,error}=await supabase.from(RECOVERIES).insert(payload).select('*').single(); if(error) throw error;
      setRecoveries(old=>[data,...old]); setModal(null); setMessage({type:'success',text:'Đã lưu kế hoạch thu hồi. Khoản này chưa được trừ tự động vào phiếu lương.'});
    } catch(e) { setMessage({type:'error',text:`Không lưu được kế hoạch thu hồi: ${errorText(e)}`}); }
    finally { setSaving(false); }
  };
  const cancelRecovery = async row => {
    if (row.status === 'POSTED') { setMessage({type:'error',text:'Không thể hủy lịch sử thu hồi đã ghi nhận.'}); return; }
    if (!window.confirm('Hủy kế hoạch thu hồi này?')) return;
    try { const {data,error}=await supabase.from(RECOVERIES).update({status:'CANCELLED',updated_at:new Date().toISOString()}).eq('id',row.id).select('*').single(); if(error) throw error; setRecoveries(old=>old.map(x=>x.id===row.id?data:x)); setMessage({type:'success',text:'Đã hủy kế hoạch thu hồi.'}); }
    catch(e){setMessage({type:'error',text:`Không hủy được kế hoạch: ${errorText(e)}`});}
  };

  return <section className="pa-page">
    <div className="pa-heading"><div className="pa-title-icon"><Wallet size={21}/></div><div><div className="pa-eyebrow">DỮ LIỆU KỲ LƯƠNG</div><h2>Khoản Bổ Sung</h2><p>Quản lý khoản cộng/trừ và lịch sử tạm ứng của nhân sự.</p></div><button className="pa-btn" onClick={load} disabled={loading}><RefreshCw size={14}/> Làm mới</button></div>
    <div className="pa-tabs"><button className={tab==='adjustments'?'active':''} onClick={()=>{setTab('adjustments');setMessage(null)}}><ArrowDownUp size={15}/> Khoản Cộng Trừ</button><button className={tab==='advances'?'active':''} onClick={()=>{setTab('advances');setMessage(null)}}><Wallet size={15}/> Tạm Ứng</button></div>
    {message && <div className={`pa-message ${message.type}`}><span>{message.type==='error'?<AlertCircle size={16}/>:<CheckCircle2 size={16}/>}</span><div>{message.text}</div><button onClick={()=>setMessage(null)} aria-label="Đóng thông báo"><X size={14}/></button></div>}
    {tab==='adjustments' ? <>
      <div className="pa-toolbar"><label className="pa-select-label">Kỳ lương<select value={periodId} onChange={e=>setPeriodId(e.target.value)}><option value="">-- Chọn kỳ lương --</option>{periods.map(p=><option key={p.id} value={p.id}>{periodLabel(p)} · {p.status==='CLOSED'?'Đã đóng':p.status==='OPEN'?'Đang mở':'Bản nháp'}</option>)}</select></label><label className="pa-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã NV, họ tên, tên khoản..."/></label><select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="ALL">Tất cả loại khoản</option><option value="ADD">Khoản Cộng</option><option value="DEDUCT">Khoản Trừ</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang áp dụng</option><option value="CANCELLED">Đã hủy</option></select><span className="pa-grow"/><button className="pa-btn primary" onClick={()=>openAdjustment(null)} disabled={!periodId||currentPeriod?.status==='CLOSED'}><Plus size={15}/> Thêm khoản</button></div>
      {currentPeriod?.status==='CLOSED'&&<div className="pa-note warning">Kỳ lương đã đóng. Dữ liệu chỉ được xem, không thể thêm, sửa hoặc xóa.</div>}
      {!periods.length&&!loading&&<div className="pa-note">Chưa có kỳ lương. Hãy tạo kỳ tại menu Quản Lý Kỳ Lương trước khi ghi nhận khoản cộng/trừ.</div>}
      {periodId&&snapshots.length===0&&!loading&&<div className="pa-note warning">Kỳ này chưa có danh sách nhân sự đã chốt trong <code>payroll_period_employees</code>. Không thể ghi khoản cộng/trừ cho đến khi dữ liệu kỳ được xác minh.</div>}
      <div className="pa-summary"><div><span>Tổng Khoản Cộng đang áp dụng</span><strong>{money(totals.add)}</strong></div><div><span>Tổng Khoản Trừ đang áp dụng</span><strong>{money(totals.deduct)}</strong></div><div><span>Chênh lệch</span><strong className={totals.add-totals.deduct<0?'negative':'positive'}>{money(totals.add-totals.deduct)}</strong></div></div>
      <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Nhân sự</th><th>Loại khoản</th><th>Tên khoản</th><th>Ngày ghi nhận</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleAdjustments.map(row=><tr key={row.id}><td><strong>{row.employee_name}</strong><small>{row.employee_code}</small></td><td><span className={`pa-pill ${row.kind==='ADD'?'add':'deduct'}`}>{row.kind==='ADD'?'Khoản Cộng':'Khoản Trừ'}</span></td><td><strong>{row.name}</strong>{row.description&&<small>{row.description}</small>}</td><td>{dateLabel(row.effective_date)}</td><td className="pa-money">{money(row.amount)}</td><td><span className={`pa-pill ${row.status==='ACTIVE'?'active':'cancelled'}`}>{row.status==='ACTIVE'?'Đang áp dụng':'Đã hủy'}</span></td><td><div className="pa-actions"><button className="pa-icon-btn" title="Sửa" disabled={currentPeriod?.status==='CLOSED'} onClick={()=>openAdjustment(row)}><Pencil size={14}/></button><button className="pa-icon-btn danger" title="Xóa" disabled={currentPeriod?.status==='CLOSED'} onClick={()=>deleteAdjustment(row)}><Trash2 size={14}/></button></div></td></tr>)}{!visibleAdjustments.length&&<tr><td colSpan="7" className="pa-empty">{loading?'Đang tải dữ liệu…':periodId?'Chưa có khoản cộng/trừ phù hợp trong kỳ này.':'Chọn kỳ lương để xem dữ liệu.'}</td></tr>}</tbody></table></div>
      <div className="pa-footnote">Nhân sự được chọn theo danh sách đã chốt của kỳ lương. Tổng hợp trên màn hình chỉ gồm các khoản đang áp dụng; việc kết nối tự động vào công thức tính lương cần được kiểm thử cùng module TÍNH LƯƠNG.</div>
    </> : <>
      <div className="pa-toolbar"><label className="pa-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã NV, họ tên, mã tạm ứng..."/></label><span className="pa-grow"/><button className="pa-btn" onClick={()=>{setRecoveryFor(null);setRecoveryForm({advance_id:'',period_id:'',amount:'',notes:''});setModal('recovery')}}><CalendarDays size={15}/> Lập kế hoạch thu hồi</button><button className="pa-btn primary" onClick={()=>openAdvance(null)}><Plus size={15}/> Tạo tạm ứng</button></div>
      <div className="pa-summary"><div><span>Tổng tạm ứng</span><strong>{money(visibleAdvances.reduce((s,a)=>s+Number(a.amount||0),0))}</strong></div><div><span>Đã thu hồi / đã ghi nhận</span><strong>{money(visibleAdvances.reduce((s,a)=>s+recoveryTotal(a.id),0))}</strong></div><div><span>Còn phải thu hồi</span><strong>{money(visibleAdvances.reduce((s,a)=>s+balance(a),0))}</strong></div></div>
      <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Mã tạm ứng</th><th>Nhân sự</th><th>Ngày tạm ứng</th><th>Tổng tạm ứng</th><th>Đã thu hồi</th><th>Còn phải thu hồi</th><th>Kỳ dự kiến bắt đầu</th><th>Thao tác</th></tr></thead><tbody>{visibleAdvances.map(row=><tr key={row.id}><td><strong>{row.code || `TU-${String(row.id).slice(0,8).toUpperCase()}`}</strong><small>{row.description||'Không có ghi chú'}</small></td><td><strong>{row.employee_name}</strong><small>{row.employee_code}</small></td><td>{dateLabel(row.advance_date)}</td><td className="pa-money">{money(row.amount)}</td><td>{money(recoveryTotal(row.id))}</td><td className="pa-money">{money(balance(row))}</td><td>{periodLabel(periods.find(p=>p.id===row.start_period_id))}</td><td><div className="pa-actions"><button className="pa-icon-btn" title="Lập thu hồi" onClick={()=>{setRecoveryForm({advance_id:row.id,period_id:'',amount:String(balance(row)||''),notes:''});setModal('recovery')}} disabled={availableToPlan(row)<=0||row.status!=='ACTIVE'}><Coins size={14}/></button><button className="pa-icon-btn" title="Sửa" onClick={()=>openAdvance(row)}><Pencil size={14}/></button><button className="pa-icon-btn" title="Lịch sử thu hồi" onClick={()=>setRecoveryFor(row)}><History size={14}/></button></div></td></tr>)}{!visibleAdvances.length&&<tr><td colSpan="8" className="pa-empty">{loading?'Đang tải dữ liệu…':'Chưa có hồ sơ tạm ứng.'}</td></tr>}</tbody></table></div>
      {recoveryFor&&<div className="pa-card"><div className="pa-card-heading"><div><h3>Lịch sử thu hồi · {recoveryFor.employee_name}</h3><p>{recoveryFor.employee_code} · Còn phải thu hồi: {money(balance(recoveryFor))} · Đã lập kế hoạch: {money(plannedTotal(recoveryFor.id))}</p></div><button className="pa-icon-btn" onClick={()=>setRecoveryFor(null)}><X size={14}/></button></div><div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Kỳ lương</th><th>Số tiền</th><th>Trạng thái</th><th>Ghi chú</th><th></th></tr></thead><tbody>{recoveries.filter(r=>r.advance_id===recoveryFor.id).map(r=><tr key={r.id}><td>{periodLabel(periods.find(p=>p.id===r.period_id))}</td><td>{money(r.amount)}</td><td><span className={`pa-pill ${r.status==='CANCELLED'?'cancelled':r.status==='POSTED'?'active':'planned'}`}>{r.status==='CANCELLED'?'Đã hủy':r.status==='POSTED'?'Đã ghi nhận':'Dự kiến'}</span></td><td>{r.notes||'—'}</td><td><button className="pa-icon-btn danger" title="Hủy kế hoạch" disabled={r.status!=='PLANNED'} onClick={()=>cancelRecovery(r)}><Trash2 size={14}/></button></td></tr>)}{!recoveries.some(r=>r.advance_id===recoveryFor.id)&&<tr><td colSpan="5" className="pa-empty">Chưa có lịch sử thu hồi.</td></tr>}</tbody></table></div></div>}
      <div className="pa-note warning">Kế hoạch thu hồi được lưu riêng và chưa tự động khấu trừ vào lương. Chỉ tích hợp khấu trừ thực tế sau khi xác minh cấu trúc module TÍNH LƯƠNG để tránh ghi nhận trùng.</div>
    </>}

    {modal&&<div className="pa-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setModal(null)}}><div className="pa-modal" role="dialog" aria-modal="true"><div className="pa-modal-head"><div><h3>{modal==='adjustment'?(adjustmentForm.id?'Sửa khoản cộng/trừ':'Thêm khoản cộng/trừ'):modal==='advance'?(advanceForm.id?'Sửa hồ sơ tạm ứng':'Tạo khoản tạm ứng'):'Lập kế hoạch thu hồi tạm ứng'}</h3><p>Dữ liệu được lưu trực tiếp trên Supabase.</p></div><button className="pa-icon-btn" onClick={()=>setModal(null)} disabled={saving}><X size={15}/></button></div>
      {modal==='adjustment'&&<form onSubmit={saveAdjustment}><div className="pa-form-grid"><label>Kỳ lương<select value={adjustmentForm.period_id} onChange={e=>setAdjustmentForm(f=>({...f,period_id:e.target.value,employee_id:''}))} required><option value="">-- Chọn kỳ --</option>{periods.filter(p=>p.id===periodId&&p.status!=='CLOSED').map(p=><option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</select></label><label className="full">Nhân sự thuộc kỳ<select multiple value={adjustmentForm.id?[adjustmentForm.employee_id]:adjustmentForm.employee_ids} disabled={Boolean(adjustmentForm.id)} onChange={e=>setAdjustmentForm(f=>({...f,employee_ids:Array.from(e.target.selectedOptions).map(o=>o.value)}))} required size={Math.min(6,Math.max(3,eligibleEmployees.length))}>{eligibleEmployees.map(e=><option key={e.id} value={e.id}>{e.employee_code} · {e.employee_name}</option>)}</select><small>Giữ Ctrl để chọn nhiều nhân sự. Danh sách lấy từ nhân sự đã chốt của kỳ đang chọn.</small></label><label>Loại khoản<select value={adjustmentForm.kind} onChange={e=>setAdjustmentForm(f=>({...f,kind:e.target.value}))}><option value="ADD">Khoản Cộng</option><option value="DEDUCT">Khoản Trừ</option></select></label><label>Tên khoản<input value={adjustmentForm.name} onChange={e=>setAdjustmentForm(f=>({...f,name:e.target.value}))} required maxLength={160} placeholder="Nhập tên khoản"/></label><label>Số tiền (VNĐ)<input type="number" min="1" step="1" value={adjustmentForm.amount} onChange={e=>setAdjustmentForm(f=>({...f,amount:e.target.value}))} required/></label>{!adjustmentForm.id&&<label>Cách áp dụng số tiền<select value={adjustmentForm.amount_mode} onChange={e=>setAdjustmentForm(f=>({...f,amount_mode:e.target.value}))}><option value="PER_EMPLOYEE">Số tiền cho mỗi nhân sự</option><option value="SPLIT_TOTAL">Tổng tiền chia đều cho nhân sự đã chọn</option></select></label>}<label>Ngày ghi nhận<input type="date" value={adjustmentForm.effective_date} onChange={e=>setAdjustmentForm(f=>({...f,effective_date:e.target.value}))} required/></label><label>Trạng thái<select value={adjustmentForm.status} onChange={e=>setAdjustmentForm(f=>({...f,status:e.target.value}))}><option value="ACTIVE">Đang áp dụng</option><option value="CANCELLED">Đã hủy</option></select></label><label className="full">Ghi chú<input value={adjustmentForm.description} onChange={e=>setAdjustmentForm(f=>({...f,description:e.target.value}))} maxLength={1000}/></label></div><div className="pa-modal-actions"><button type="button" className="pa-btn" onClick={()=>setModal(null)} disabled={saving}>Hủy</button><button type="submit" className="pa-btn primary" disabled={saving}><Save size={14}/>{saving?'Đang lưu…':'Lưu khoản'}</button></div></form>}
      {modal==='advance'&&<form onSubmit={saveAdvance}><div className="pa-form-grid"><label>Nhân sự<select value={advanceForm.employee_id} onChange={e=>setAdvanceForm(f=>({...f,employee_id:e.target.value}))} required><option value="">-- Chọn nhân sự --</option>{allEmployeeOptions.map(e=><option key={e.id} value={e.id}>{e.employee_code} · {e.employee_name}</option>)}</select></label><label>Ngày tạm ứng<input type="date" value={advanceForm.advance_date} onChange={e=>setAdvanceForm(f=>({...f,advance_date:e.target.value}))} required/></label><label>Số tiền tạm ứng (VNĐ)<input type="number" min="1" step="1" value={advanceForm.amount} onChange={e=>setAdvanceForm(f=>({...f,amount:e.target.value}))} required/></label><label>Kỳ dự kiến bắt đầu thu hồi<select value={advanceForm.start_period_id} onChange={e=>setAdvanceForm(f=>({...f,start_period_id:e.target.value}))}><option value="">-- Chưa xác định --</option>{periods.filter(p=>p.type==='FIXED'&&p.status!=='CLOSED').map(p=><option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</select></label><label>Trạng thái<select value={advanceForm.status} onChange={e=>setAdvanceForm(f=>({...f,status:e.target.value}))}><option value="ACTIVE">Đang theo dõi</option><option value="CANCELLED">Đã hủy</option></select></label><label className="full">Nội dung / lý do<input value={advanceForm.description} onChange={e=>setAdvanceForm(f=>({...f,description:e.target.value}))} maxLength={1000}/></label></div><p className="pa-help">Tạo hồ sơ tạm ứng không tự xác nhận đã chi tiền và không tự khấu trừ vào lương.</p><div className="pa-modal-actions"><button type="button" className="pa-btn" onClick={()=>setModal(null)} disabled={saving}>Hủy</button><button type="submit" className="pa-btn primary" disabled={saving}><Save size={14}/>{saving?'Đang lưu…':'Lưu tạm ứng'}</button></div></form>}
      {modal==='recovery'&&<form onSubmit={saveRecovery}><div className="pa-form-grid"><label>Khoản tạm ứng<select value={recoveryForm.advance_id} onChange={e=>{const a=advances.find(x=>x.id===e.target.value);setRecoveryForm(f=>({...f,advance_id:e.target.value,amount:a?String(balance(a)) : ''}))}} required><option value="">-- Chọn khoản tạm ứng --</option>{advances.filter(a=>a.status==='ACTIVE'&&balance(a)>0).map(a=><option key={a.id} value={a.id}>{a.employee_code} · {a.employee_name} · Còn {money(balance(a))}</option>)}</select></label><label>Kỳ lương thu hồi<select value={recoveryForm.period_id} onChange={e=>setRecoveryForm(f=>({...f,period_id:e.target.value}))} required><option value="">-- Chọn kỳ --</option>{periods.filter(p=>p.type==='FIXED'&&p.status!=='CLOSED').map(p=><option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</select></label><label>Số tiền dự kiến thu hồi (VNĐ)<input type="number" min="1" step="1" value={recoveryForm.amount} onChange={e=>setRecoveryForm(f=>({...f,amount:e.target.value}))} required/></label><label>Ghi chú<input value={recoveryForm.notes} onChange={e=>setRecoveryForm(f=>({...f,notes:e.target.value}))} maxLength={1000}/></label></div><p className="pa-help">Chỉ tạo kế hoạch. Chưa cập nhật số tiền đã thu hồi và chưa trừ khỏi phiếu lương cho đến khi có tích hợp tính lương được kiểm thử.</p><div className="pa-modal-actions"><button type="button" className="pa-btn" onClick={()=>setModal(null)} disabled={saving}>Hủy</button><button type="submit" className="pa-btn primary" disabled={saving}><Save size={14}/>{saving?'Đang lưu…':'Lưu kế hoạch'}</button></div></form>}
    </div></div>}
  </section>;
}
