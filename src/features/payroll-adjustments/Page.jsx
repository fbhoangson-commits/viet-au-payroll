import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import * as XLSX from 'xlsx';
import { Plus, RefreshCw, Search, Pencil, Trash2, X, Save, Wallet, ArrowDownUp, CalendarDays, AlertCircle, CheckCircle2, Coins, History, Download, Upload, FileSpreadsheet } from 'lucide-react';
import './payroll-adjustments.css';

const ADJUSTMENTS = 'payroll_adjustments';
const ADVANCES = 'payroll_advances';
const RECOVERIES = 'payroll_advance_recoveries';
const money = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
const dateLabel = value => value ? new Date(`${String(value).slice(0,10)}T00:00:00`).toLocaleDateString('vi-VN') : '—';
const today = () => new Date().toISOString().slice(0,10);
const currentMonth = () => new Date().toISOString().slice(0,7);
const codeOf = e => String(e?.employee_code || e?.code || '').trim();
const periodKeyOf = p => {
  const value = String(p?.month || p?.code || p?.name || '').trim();
  const match = value.match(/(20\d{2})[-/](0[1-9]|1[0-2])/);
  if (match) return `${match[1]}-${match[2]}`;
  const compact = value.match(/(20\d{2})(0[1-9]|1[0-2])$/);
  return compact ? `${compact[1]}-${compact[2]}` : '';
};
const monthKey = value => {
  const text = String(value ?? '').trim();
  if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(text)) return text;
  const match = text.match(/^(20\d{2})[/.](0?[1-9]|1[0-2])$/);
  return match ? `${match[1]}-${String(match[2]).padStart(2,'0')}` : '';
};
const adjustmentStatus = value => {
  const text = String(value ?? '').trim().toLocaleLowerCase('vi');
  if (['đã hủy','da huy','cancelled','canceled','inactive'].includes(text)) return 'CANCELLED';
  return ['đang áp dụng','dang ap dung','active','áp dụng'].includes(text) ? 'ACTIVE' : '';
};
const nameOf = e => String(e?.employee_name || e?.full_name || e?.name || codeOf(e) || 'Chưa có tên');
const initialAdjustment = () => ({ period_id:'', employee_id:'', employee_ids:[], amount_mode:'PER_EMPLOYEE', kind:'ADD', application_type:'PER_PERIOD', quantity:'1', unit:'Tháng', unit_price:'0', name:'', amount:'0', period_code:'', effective_from:currentMonth(), effective_to:'', effective_date:today(), description:'', status:'ACTIVE' });
const initialAdvance = () => ({ employee_id:'', advance_date:today(), amount:'', description:'', start_period_id:'', status:'ACTIVE' });
const errorText = e => e?.message || String(e || 'Đã xảy ra lỗi.');
const csvCell = value => { const text = String(value ?? ''); return /[\",\r\n]/.test(text) ? `\"${text.replace(/\"/g,'\"\"')}\"` : text; };
const downloadCsv = (filename, headers, rows) => {
  const content = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
};
const downloadWorkbook = (filename, headers, rows, guidance) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map(h => ({ wch: Math.max(14, Math.min(30, String(h).length + 4)) }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'DuLieu');
  const guideSheet = XLSX.utils.aoa_to_sheet([['HƯỚNG DẪN IMPORT'], ['1. Không sửa tên các cột ở dòng đầu tiên.'], ['2. Mỗi dòng tương ứng một bản ghi.'], ['3. Mã nhân viên phải tồn tại trong hệ thống.'], ['4. Số tiền nhập bằng số nguyên VNĐ, không kèm ký hiệu tiền tệ.'], ['5. Ngày nhập theo định dạng YYYY-MM-DD.'], ...guidance.map(line => [line])]);
  guideSheet['!cols'] = [{ wch: 95 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'HuongDan');
  XLSX.writeFile(workbook, filename);
};
const normalizeHeader = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const normalizeDate = value => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  if (typeof value === 'number' && Number.isFinite(value)) { const d = XLSX.SSF.parse_date_code(value); if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`; }
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  return match ? `${match[3]}-${String(match[2]).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}` : text;
};
const parseCsv = text => {
  const input = String(text || '').replace(/^\uFEFF/, ''); const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i=0; i<input.length; i++) { const ch=input[i];
    if (quoted) { if (ch==='\"' && input[i+1]==='\"') { cell+='\"'; i++; } else if (ch==='\"') quoted=false; else cell+=ch; }
    else if (ch==='\"' && cell==='') quoted=true;
    else if (ch===',') { row.push(cell); cell=''; }
    else if (ch==='\n') { row.push(cell.replace(/\r$/, '')); if (row.some(v=>v.trim()!=='')) rows.push(row); row=[]; cell=''; }
    else cell+=ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); if (row.some(v=>v.trim()!=='')) rows.push(row); }
  if (!rows.length) return [];
  const headers=rows.shift().map(v=>v.trim().toLowerCase().replace(/\s+/g,'_'));
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,String(values[i] ?? '').trim()])));
};
const csvNumber = value => Number(String(value ?? '').replace(/[\s₫đ]/gi,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(/,/g,'.'));

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
  const importInputRef = useRef(null);
  const [importBusy, setImportBusy] = useState(false);

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
    const selectedKey = periodKeyOf(currentPeriod);
    return adjustments.filter(r => {
      const mode = r.application_type || 'PER_PERIOD';
      if (mode === 'FIXED') {
        const from = monthKey(r.effective_from);
        const to = monthKey(r.effective_to);
        return Boolean(selectedKey && from && selectedKey >= from && (!to || selectedKey <= to));
      }
      return r.period_id === periodId || (r.period_code && String(r.period_code) === String(currentPeriod?.code));
    })
      .filter(r => kindFilter === 'ALL' || r.kind === kindFilter)
      .filter(r => statusFilter === 'ALL' || r.status === statusFilter)
      .filter(r => !q || [r.employee_code,r.employee_name,r.name,r.description,r.code].some(v => String(v || '').toLocaleLowerCase('vi').includes(q)));
  }, [adjustments, periodId, currentPeriod, kindFilter, statusFilter, search]);
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
    setAdjustmentForm(row ? {
      period_id:row.period_id, employee_id:row.employee_id, employee_ids:[row.employee_id], amount_mode:'PER_EMPLOYEE',
      kind:row.kind, application_type:row.application_type || 'PER_PERIOD', quantity:String(row.quantity ?? 1),
      unit:row.unit || 'Tháng', unit_price:String(row.unit_price ?? row.amount ?? 0), name:row.name || '',
      amount:String(row.amount ?? ''), period_code:row.period_code || '', effective_from:row.effective_from || periodKeyOf(currentPeriod) || currentMonth(),
      effective_to:row.effective_to || '', effective_date:row.effective_date || today(), description:row.description || '',
      status:row.status || 'ACTIVE', id:row.id
    } : {...initialAdjustment(),period_id:periodId,effective_from:periodKeyOf(currentPeriod) || currentMonth()});
    setModal('adjustment'); setMessage(null);
  };
  const openAdvance = row => {
    setAdvanceForm(row ? {employee_id:row.employee_id,advance_date:row.advance_date || today(),amount:String(row.amount ?? ''),description:row.description || '',start_period_id:row.start_period_id || '',status:row.status || 'ACTIVE',id:row.id} : initialAdvance());
    setModal('advance'); setMessage(null);
  };
  const saveAdjustment = async event => {
    event.preventDefault(); if (saving) return;
    const quantity = csvNumber(adjustmentForm.quantity);
    const unitPrice = csvNumber(adjustmentForm.unit_price);
    const amount = quantity * unitPrice;
    const mode = adjustmentForm.application_type || 'PER_PERIOD';
    const from = monthKey(adjustmentForm.effective_from);
    const to = monthKey(adjustmentForm.effective_to);
    const targetPeriod = mode === 'FIXED'
      ? (periods.find(p => periodKeyOf(p) === from) || currentPeriod)
      : periods.find(p => p.id === adjustmentForm.period_id);
    if (!targetPeriod || !adjustmentForm.name.trim() || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(amount) || amount < 0) {
      setMessage({type:'error',text:'Vui lòng nhập đầy đủ tên khoản, số lượng và đơn giá hợp lệ.'}); return;
    }
    if (mode === 'FIXED' && (!from || (to && to < from))) {
      setMessage({type:'error',text:'Khoản Cố định cần có kỳ Áp dụng từ hợp lệ; kỳ Áp dụng đến phải lớn hơn hoặc bằng kỳ bắt đầu.'}); return;
    }
    if (mode === 'PER_PERIOD' && (!adjustmentForm.period_id || targetPeriod.status === 'CLOSED')) {
      setMessage({type:'error',text:'Khoản Theo kỳ phải gắn với một kỳ lương đang mở.'}); return;
    }
    if (currentPeriod?.status === 'CLOSED') { setMessage({type:'error',text:'Kỳ lương đang chọn đã đóng, không thể ghi dữ liệu.'}); return; }
    const selectedIds = adjustmentForm.id ? [adjustmentForm.employee_id] : [...new Set(adjustmentForm.employee_ids || [])];
    if (!selectedIds.length) { setMessage({type:'error',text:'Vui lòng chọn ít nhất một nhân sự thuộc danh sách đã chốt của kỳ lương.'}); return; }
    const selectedSnapshots = selectedIds.map(id => snapshotById.get(id)).filter(Boolean);
    if (selectedSnapshots.length !== selectedIds.length) { setMessage({type:'error',text:'Có nhân sự không thuộc danh sách đã chốt của kỳ đang chọn. Vui lòng tải lại dữ liệu.'}); return; }
    setSaving(true); setMessage(null);
    try {
      const userId = (await supabase.auth.getUser()).data?.user?.id || null;
      const payloads = selectedSnapshots.map((snap,index) => ({
        period_id: targetPeriod.id, period_code: mode === 'PER_PERIOD' ? (targetPeriod.code || periodKeyOf(targetPeriod)) : null,
        employee_id:snap.employee_id, employee_code:snap.employee_code, employee_name:snap.employee_name,
        kind:adjustmentForm.kind, application_type:mode, quantity, unit:String(adjustmentForm.unit || '').trim() || null,
        unit_price:unitPrice, name:adjustmentForm.name.trim(),
        amount:adjustmentForm.amount_mode==='SPLIT_TOTAL'&&!adjustmentForm.id ? Math.floor(amount/selectedSnapshots.length)+(index < amount%selectedSnapshots.length ? 1 : 0) : amount,
        effective_from:mode === 'FIXED' ? from : periodKeyOf(targetPeriod),
        effective_to:mode === 'FIXED' ? (to || null) : null,
        effective_date:adjustmentForm.effective_date || today(), description:adjustmentForm.description.trim() || null,
        status:adjustmentForm.status, updated_at:new Date().toISOString(), ...(!adjustmentForm.id?{created_by:userId}:{})
      }));
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

  const exportCurrent = () => {
    if (tab === 'adjustments') {
      downloadWorkbook(`KHOAN_CONG_TRU_${periodKeyOf(currentPeriod) || 'ky-luong'}.xlsx`,
        ['MNV','Họ tên','Tên khoản','Loại khoản','Dạng áp dụng','Số lượng','Đơn vị tính','Đơn giá','Thành tiền','Số tiền','Kỳ áp dụng','Áp dụng từ','Áp dụng đến','Ghi chú','Trạng thái'],
        visibleAdjustments.map(r=>[
          r.employee_code,r.employee_name,r.name,r.kind==='ADD'?'Cộng':'Trừ',
          (r.application_type || 'PER_PERIOD')==='FIXED'?'Cố định':'Theo kỳ',
          Number(r.quantity ?? 1),r.unit || '',Number(r.unit_price ?? r.amount ?? 0),
          Number(r.amount || 0),Number(r.amount || 0),
          (r.application_type || 'PER_PERIOD')==='FIXED'?'':(periodKeyOf(periods.find(p=>p.id===r.period_id)) || periodKeyOf(currentPeriod) || ''),
          r.effective_from || periodKeyOf(periods.find(p=>p.id===r.period_id)) || '',
          r.effective_to || '',r.description || '',
          r.status==='CANCELLED'?'Đã hủy':'Đang áp dụng'
        ]),
        ['MNV phải khớp với Nhân Sự Master.','Import tạo bản ghi mới, không sửa hoặc xóa bản ghi cũ.','Cố định: áp dụng từ kỳ bắt đầu đến kỳ kết thúc; để trống kỳ kết thúc nếu chưa xác định.','Theo kỳ: chỉ áp dụng đúng kỳ lương ghi trong cột Kỳ áp dụng.','Thành tiền = Số lượng × Đơn giá.','Loại khoản: Cộng hoặc Trừ.','Dạng áp dụng: Cố định hoặc Theo kỳ.']);
    } else {
      downloadWorkbook('tam-ung.xlsx',
        ['employee_code','employee_name','advance_date','amount','description','start_period_code','status'],
        visibleAdvances.map(r=>[r.employee_code,r.employee_name,r.advance_date,r.amount,r.description || '',periods.find(p=>p.id===r.start_period_id)?.code || '',r.status]), ['status chỉ nhận ACTIVE hoặc CANCELLED. start_period_code là mã kỳ lương cố định, có thể để trống.']);
    }
    setMessage({type:'success',text:'Đã xuất file Excel (.xlsx) theo danh sách đang hiển thị, kèm sheet hướng dẫn.'});
  };
  const downloadTemplate = () => {
    if (tab === 'adjustments') downloadWorkbook('KHOAN_CONG_TRU_MAU_IMPORT.xlsx',
      ['MNV','Họ tên','Tên khoản','Loại khoản','Dạng áp dụng','Số lượng','Đơn vị tính','Đơn giá','Thành tiền','Số tiền','Kỳ áp dụng','Áp dụng từ','Áp dụng đến','Ghi chú','Trạng thái'], [],
      ['MNV phải khớp với Nhân Sự Master.','Import sẽ tạo bản ghi mới, không sửa hoặc xóa bản ghi cũ.','Cố định: áp dụng từ kỳ bắt đầu đến kỳ kết thúc (để trống kỳ kết thúc nếu chưa xác định).','Theo kỳ: chỉ áp dụng đúng kỳ lương ghi trong cột Kỳ áp dụng.','Thành tiền = Số lượng × Đơn giá.','Loại khoản chỉ nhận Cộng hoặc Trừ.','Dạng áp dụng chỉ nhận Cố định hoặc Theo kỳ.','Kỳ và thời gian áp dụng dùng định dạng YYYY-MM.','Dữ liệu import được lưu trên Supabase.']);
    else downloadWorkbook('mau-import-tam-ung.xlsx',
      ['employee_code','advance_date','amount','description','start_period_code','status'], [], ['employee_code phải tồn tại trong Nhân Sự Master.', 'start_period_code phải là mã kỳ lương cố định đang tồn tại nếu có nhập.']);
    setMessage({type:'success',text:'Đã tải mẫu Excel trống gồm sheet dữ liệu và sheet hướng dẫn.'});
  };
  const importCsvFile = async file => {
    if (!file) return;
    if (importBusy) return;
    if (tab==='adjustments' && (!periodId || currentPeriod?.status==='CLOSED')) {
      setMessage({type:'error',text:'Hãy chọn kỳ lương đang mở trước khi import Khoản Cộng Trừ.'}); return;
    }
    if (!window.confirm(`Import dữ liệu ${tab==='adjustments'?'Khoản Cộng Trừ':'Tạm Ứng'} từ file ${file.name}? Dữ liệu hợp lệ sẽ được thêm mới; các dòng trùng đã có sẽ được bỏ qua.`)) return;
    setImportBusy(true); setMessage(null);
    try {
      let rows;
      if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text());
      else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) throw new Error('Không tìm thấy sheet dữ liệu trong file Excel.');
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval:'', raw:true });
        rows = rawRows.map(raw => Object.fromEntries(Object.entries(raw).map(([key,value]) => [normalizeHeader(key), value])));
      }
      rows = rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [normalizeHeader(key), value])));
      if (!rows.length) throw new Error('File không có dữ liệu. Hãy dùng mẫu CSV và điền các dòng dữ liệu.');
      const userId=(await supabase.auth.getUser()).data?.user?.id || null;
      const errors=[]; let skipped=0; let inserted=0;
      if (tab==='adjustments') {
        const payloads=[];
        rows.forEach((r,i)=>{
          const line=i+2;
          const empCode=String(r.mnv || r.employee_code || r.ma_nhan_vien || '').trim();
          const employee=employees.find(e=>codeOf(e).toLowerCase()===empCode.toLowerCase());
          const rawKind=String(r.loai_khoan || r.kind || '').trim().toLocaleLowerCase('vi');
          const kind=['add','cộng','cong','khoản cộng','khoan cong'].includes(rawKind)?'ADD':['deduct','trừ','tru','khoản trừ','khoan tru'].includes(rawKind)?'DEDUCT':'';
          const rawMode=String(r.dang_ap_dung || r.application_type || '').trim().toLocaleLowerCase('vi');
          const applicationType=['cố định','co dinh','fixed'].includes(rawMode)?'FIXED':['theo kỳ','theo ky','per_period'].includes(rawMode)?'PER_PERIOD':'';
          const name=String(r.ten_khoan || r.name || '').trim();
          const quantityRaw=r.so_luong === '' || r.so_luong == null ? 0 : csvNumber(r.so_luong);
          const unit=String(r.don_vi_tinh || r.unit || '').trim();
          const unitPrice=csvNumber(r.don_gia ?? r.unit_price);
          const suppliedRaw=[r.thanh_tien,r.so_tien,r.amount].find(v=>v!==undefined && String(v).trim()!=='');
          const suppliedAmount=suppliedRaw===undefined ? calculatedAmount : csvNumber(suppliedRaw);
          const calculatedAmount=quantityRaw*unitPrice;
          const amount=Number.isFinite(suppliedAmount) && (r.thanh_tien !== undefined || r.so_tien !== undefined || r.amount !== undefined) ? suppliedAmount : calculatedAmount;
          const periodCode=String(r.ky_ap_dung || r.period_code || '').trim();
          const from=monthKey(r.ap_dung_tu || r.effective_from);
          const to=monthKey(r.ap_dung_den || r.effective_to);
          const targetPeriodCode=applicationType==='FIXED' ? (from || periodKeyOf(currentPeriod)) : monthKey(periodCode) || periodCode;
          const targetPeriod=periods.find(p => periodKeyOf(p)===targetPeriodCode || String(p.code||'').trim().toLowerCase()===targetPeriodCode.toLowerCase())
            || (applicationType==='FIXED' && targetPeriodCode ? periods.find(p=>periodKeyOf(p)===targetPeriodCode) : null);
          const status=adjustmentStatus(r.trang_thai || r.status || 'Đang áp dụng');
          const description=String(r.ghi_chu || r.description || '').trim() || null;
          if (!employee) { errors.push(`Dòng ${line}: MNV ${empCode || '(trống)'} không tồn tại trong Nhân Sự Master.`); return; }
          if (!kind || !applicationType || !name || !Number.isFinite(quantityRaw) || quantityRaw<0 || !Number.isFinite(unitPrice) || unitPrice<0 || !Number.isFinite(amount) || amount<0 || !status) {
            errors.push(`Dòng ${line}: thiếu hoặc sai Tên khoản, Loại khoản, Dạng áp dụng, Số lượng, Đơn vị tính, Đơn giá, Thành tiền/Số tiền hoặc Trạng thái.`); return;
          }
          if (Math.abs(calculatedAmount-amount)>0.5) { errors.push(`Dòng ${line}: Thành tiền/Số tiền (${amount}) không khớp Số lượng × Đơn giá (${calculatedAmount}).`); return; }
          if (applicationType==='FIXED' && (!from || (to && to<from))) { errors.push(`Dòng ${line}: Cố định cần kỳ Áp dụng từ hợp lệ và Áp dụng đến không được trước kỳ bắt đầu.`); return; }
          if (applicationType==='PER_PERIOD' && (!periodCode || !targetPeriod)) { errors.push(`Dòng ${line}: Theo kỳ cần Kỳ áp dụng khớp kỳ lương hiện có.`); return; }
          const effectivePeriod=targetPeriod || currentPeriod;
          if (!effectivePeriod) { errors.push(`Dòng ${line}: không xác định được kỳ lương gốc cho khoản.`); return; }
          const duplicate=adjustments.some(a=>
            a.employee_id===employee.id && a.kind===kind && String(a.name||'').trim().toLowerCase()===name.toLowerCase() &&
            (a.application_type||'PER_PERIOD')===applicationType && Number(a.amount)===amount &&
            (applicationType==='FIXED' ? monthKey(a.effective_from)===from && monthKey(a.effective_to)===to : a.period_id===effectivePeriod.id)
          );
          if (duplicate) { skipped++; return; }
          payloads.push({
            period_id:effectivePeriod.id, period_code:applicationType==='PER_PERIOD'?(effectivePeriod.code || periodKeyOf(effectivePeriod)):null,
            employee_id:employee.id, employee_code:codeOf(employee), employee_name:nameOf(employee), kind,
            application_type:applicationType, quantity:quantityRaw, unit, unit_price:unitPrice, name, amount,
            effective_from:applicationType==='FIXED'?from:periodKeyOf(effectivePeriod),
            effective_to:applicationType==='FIXED'?(to||null):null,
            effective_date:today(), description, status, created_by:userId, updated_at:new Date().toISOString()
          });
        });
        if (payloads.length) {
          const {data,error}=await supabase.from(ADJUSTMENTS).insert(payloads).select('*');
          if(error) throw error;
          setAdjustments(old=>[...(data||[]),...old]); inserted=data?.length||0;
        }
      } else {
        const payloads=[];
        rows.forEach((r,i)=>{
          const line=i+2; const empCode=String(r.employee_code || r.ma_nhan_vien || '').trim();
          const employee=employees.find(e=>codeOf(e).toLowerCase()===empCode.toLowerCase());
          const amount=csvNumber(r.amount ?? r.so_tien); const date=normalizeDate(r.advance_date || r.ngay_tam_ung || today());
          const status=String(r.status || r.trang_thai || 'ACTIVE').trim().toUpperCase();
          const periodCode=String(r.start_period_code || r.ma_ky_bat_dau_thu_hoi || '').trim();
          const startPeriod=periodCode ? periods.find(p=>String(p.code||'').toLowerCase()===periodCode.toLowerCase() && p.type==='FIXED') : null;
          if (!employee) { errors.push(`Dòng ${line}: không tìm thấy mã nhân viên ${empCode || '(trống)'}.`); return; }
          if (!Number.isFinite(amount)||amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['ACTIVE','CANCELLED'].includes(status)||(periodCode&&!startPeriod)) { errors.push(`Dòng ${line}: dữ liệu không hợp lệ (ngày, số tiền, trạng thái hoặc mã kỳ thu hồi).`); return; }
          const description=String(r.description||r.noi_dung||'').trim()||null;
          const duplicate=advances.some(a=>a.employee_id===employee.id&&a.advance_date===date&&Number(a.amount)===amount&&String(a.description||'')===String(description||''));
          if (duplicate) { skipped++; return; }
          payloads.push({employee_id:employee.id,employee_code:codeOf(employee),employee_name:nameOf(employee),advance_date:date,amount,description,start_period_id:startPeriod?.id||null,status,created_by:userId,updated_at:new Date().toISOString()});
        });
        if (payloads.length) { const {data,error}=await supabase.from(ADVANCES).insert(payloads).select('*'); if(error) throw error; setAdvances(old=>[...(data||[]),...old]); inserted=data?.length||0; }
      }
      const errorSummary=errors.length ? ` Có ${errors.length} dòng lỗi: ${errors.slice(0,5).join(' | ')}${errors.length>5?' …':''}` : '';
      setMessage({type:errors.length?'error':'success',text:`Import xong: thêm ${inserted} dòng, bỏ qua ${skipped} dòng trùng.${errorSummary}`});
    } catch(e) { setMessage({type:'error',text:`Import thất bại: ${errorText(e)}`}); }
    finally { setImportBusy(false); if(importInputRef.current) importInputRef.current.value=''; }
  };

  return <section className="pa-page">
    <div className="pa-heading"><div className="pa-title-icon"><Wallet size={21}/></div><div><div className="pa-eyebrow">DỮ LIỆU KỲ LƯƠNG</div><h2>Khoản Bổ Sung</h2><p>Quản lý khoản cộng/trừ và lịch sử tạm ứng của nhân sự.</p></div><button className="pa-btn" onClick={load} disabled={loading}><RefreshCw size={14}/> Làm mới</button></div>
    <div className="pa-tabs"><button className={tab==='adjustments'?'active':''} onClick={()=>{setTab('adjustments');setMessage(null)}}><ArrowDownUp size={15}/> Khoản Cộng Trừ</button><button className={tab==='advances'?'active':''} onClick={()=>{setTab('advances');setMessage(null)}}><Wallet size={15}/> Tạm Ứng</button></div>
    <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden onChange={e=>importCsvFile(e.target.files?.[0])}/>
    {message && <div className={`pa-message ${message.type}`}><span>{message.type==='error'?<AlertCircle size={16}/>:<CheckCircle2 size={16}/>}</span><div>{message.text}</div><button onClick={()=>setMessage(null)} aria-label="Đóng thông báo"><X size={14}/></button></div>}
    {tab==='adjustments' ? <>
      <div className="pa-toolbar"><label className="pa-select-label">Kỳ lương<select value={periodId} onChange={e=>setPeriodId(e.target.value)}><option value="">-- Chọn kỳ lương --</option>{periods.map(p=><option key={p.id} value={p.id}>{periodLabel(p)} · {p.status==='CLOSED'?'Đã đóng':p.status==='OPEN'?'Đang mở':'Bản nháp'}</option>)}</select></label><label className="pa-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã NV, họ tên, tên khoản..."/></label><select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="ALL">Tất cả loại khoản</option><option value="ADD">Khoản Cộng</option><option value="DEDUCT">Khoản Trừ</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang áp dụng</option><option value="CANCELLED">Đã hủy</option></select><span className="pa-grow"/><button className="pa-btn" onClick={downloadTemplate} title="Tải mẫu Excel"><FileSpreadsheet size={14}/> Mẫu Import</button><button className="pa-btn" onClick={()=>importInputRef.current?.click()} disabled={importBusy||!periodId||currentPeriod?.status==='CLOSED'} title="Import Excel hoặc CSV"><Upload size={14}/> {importBusy?'Đang import…':'Import'}</button><button className="pa-btn" onClick={exportCurrent} title="Export Excel"><Download size={14}/> Export</button><button className="pa-btn primary" onClick={()=>openAdjustment(null)} disabled={!periodId||currentPeriod?.status==='CLOSED'}><Plus size={15}/> Thêm khoản</button></div>
      {currentPeriod?.status==='CLOSED'&&<div className="pa-note warning">Kỳ lương đã đóng. Dữ liệu chỉ được xem, không thể thêm, sửa hoặc xóa.</div>}
      {!periods.length&&!loading&&<div className="pa-note">Chưa có kỳ lương. Hãy tạo kỳ tại menu Quản Lý Kỳ Lương trước khi ghi nhận khoản cộng/trừ.</div>}
      {periodId&&snapshots.length===0&&!loading&&<div className="pa-note warning">Kỳ này chưa có danh sách nhân sự đã chốt trong <code>payroll_period_employees</code>. Không thể ghi khoản cộng/trừ cho đến khi dữ liệu kỳ được xác minh.</div>}
      <div className="pa-summary"><div><span>Tổng Khoản Cộng đang áp dụng</span><strong>{money(totals.add)}</strong></div><div><span>Tổng Khoản Trừ đang áp dụng</span><strong>{money(totals.deduct)}</strong></div><div><span>Chênh lệch</span><strong className={totals.add-totals.deduct<0?'negative':'positive'}>{money(totals.add-totals.deduct)}</strong></div></div>
      <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Nhân sự</th><th>Tên khoản</th><th>Loại</th><th>Dạng áp dụng</th><th>Số lượng</th><th>Đơn vị</th><th>Đơn giá</th><th>Thành tiền</th><th>Kỳ áp dụng</th><th>Thời hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleAdjustments.map(row=><tr key={row.id}><td><strong>{row.employee_name}</strong><small>{row.employee_code}</small></td><td><strong>{row.name}</strong>{row.description&&<small>{row.description}</small>}</td><td><span className={`pa-pill ${row.kind==='ADD'?'add':'deduct'}`}>{row.kind==='ADD'?'Cộng':'Trừ'}</span></td><td>{(row.application_type||'PER_PERIOD')==='FIXED'?'Cố định':'Theo kỳ'}</td><td>{Number(row.quantity ?? 1).toLocaleString('vi-VN')}</td><td>{row.unit||'—'}</td><td className="pa-money">{money(row.unit_price ?? row.amount)}</td><td className="pa-money">{money(row.amount)}</td><td>{(row.application_type||'PER_PERIOD')==='FIXED'?'—':periodKeyOf(periods.find(p=>p.id===row.period_id))}</td><td>{(row.application_type||'PER_PERIOD')==='FIXED'?`${row.effective_from||'—'} → ${row.effective_to||'Không giới hạn'}`:(row.effective_from||periodKeyOf(periods.find(p=>p.id===row.period_id)))}</td><td><span className={`pa-pill ${row.status==='ACTIVE'?'active':'cancelled'}`}>{row.status==='ACTIVE'?'Đang áp dụng':'Đã hủy'}</span></td><td><div className="pa-actions"><button className="pa-icon-btn" title="Sửa" disabled={currentPeriod?.status==='CLOSED'} onClick={()=>openAdjustment(row)}><Pencil size={14}/></button><button className="pa-icon-btn danger" title="Xóa" disabled={currentPeriod?.status==='CLOSED'} onClick={()=>deleteAdjustment(row)}><Trash2 size={14}/></button></div></td></tr>)}{!visibleAdjustments.length&&<tr><td colSpan="12" className="pa-empty">{loading?'Đang tải dữ liệu…':periodId?'Chưa có khoản cộng/trừ phù hợp trong kỳ này.':'Chọn kỳ lương để xem dữ liệu.'}</td></tr>}</tbody></table></div>
      <div className="pa-footnote">Nhân sự được chọn theo danh sách đã chốt của kỳ lương. Tổng hợp trên màn hình chỉ gồm các khoản đang áp dụng; việc kết nối tự động vào công thức tính lương cần được kiểm thử cùng module TÍNH LƯƠNG.</div>
    </> : <>
      <div className="pa-toolbar"><label className="pa-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm mã NV, họ tên, mã tạm ứng..."/></label><span className="pa-grow"/><button className="pa-btn" onClick={downloadTemplate} title="Tải mẫu Excel"><FileSpreadsheet size={14}/> Mẫu Import</button><button className="pa-btn" onClick={()=>importInputRef.current?.click()} disabled={importBusy} title="Import Excel hoặc CSV"><Upload size={14}/> {importBusy?'Đang import…':'Import'}</button><button className="pa-btn" onClick={exportCurrent} title="Export Excel"><Download size={14}/> Export</button><button className="pa-btn" onClick={()=>{setRecoveryFor(null);setRecoveryForm({advance_id:'',period_id:'',amount:'',notes:''});setModal('recovery')}}><CalendarDays size={15}/> Lập kế hoạch thu hồi</button><button className="pa-btn primary" onClick={()=>openAdvance(null)}><Plus size={15}/> Tạo tạm ứng</button></div>
      <div className="pa-summary"><div><span>Tổng tạm ứng</span><strong>{money(visibleAdvances.reduce((s,a)=>s+Number(a.amount||0),0))}</strong></div><div><span>Đã thu hồi / đã ghi nhận</span><strong>{money(visibleAdvances.reduce((s,a)=>s+recoveryTotal(a.id),0))}</strong></div><div><span>Còn phải thu hồi</span><strong>{money(visibleAdvances.reduce((s,a)=>s+balance(a),0))}</strong></div></div>
      <div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Mã tạm ứng</th><th>Nhân sự</th><th>Ngày tạm ứng</th><th>Tổng tạm ứng</th><th>Đã thu hồi</th><th>Còn phải thu hồi</th><th>Kỳ dự kiến bắt đầu</th><th>Thao tác</th></tr></thead><tbody>{visibleAdvances.map(row=><tr key={row.id}><td><strong>{row.code || `TU-${String(row.id).slice(0,8).toUpperCase()}`}</strong><small>{row.description||'Không có ghi chú'}</small></td><td><strong>{row.employee_name}</strong><small>{row.employee_code}</small></td><td>{dateLabel(row.advance_date)}</td><td className="pa-money">{money(row.amount)}</td><td>{money(recoveryTotal(row.id))}</td><td className="pa-money">{money(balance(row))}</td><td>{periodLabel(periods.find(p=>p.id===row.start_period_id))}</td><td><div className="pa-actions"><button className="pa-icon-btn" title="Lập thu hồi" onClick={()=>{setRecoveryForm({advance_id:row.id,period_id:'',amount:String(balance(row)||''),notes:''});setModal('recovery')}} disabled={availableToPlan(row)<=0||row.status!=='ACTIVE'}><Coins size={14}/></button><button className="pa-icon-btn" title="Sửa" onClick={()=>openAdvance(row)}><Pencil size={14}/></button><button className="pa-icon-btn" title="Lịch sử thu hồi" onClick={()=>setRecoveryFor(row)}><History size={14}/></button></div></td></tr>)}{!visibleAdvances.length&&<tr><td colSpan="8" className="pa-empty">{loading?'Đang tải dữ liệu…':'Chưa có hồ sơ tạm ứng.'}</td></tr>}</tbody></table></div>
      {recoveryFor&&<div className="pa-card"><div className="pa-card-heading"><div><h3>Lịch sử thu hồi · {recoveryFor.employee_name}</h3><p>{recoveryFor.employee_code} · Còn phải thu hồi: {money(balance(recoveryFor))} · Đã lập kế hoạch: {money(plannedTotal(recoveryFor.id))}</p></div><button className="pa-icon-btn" onClick={()=>setRecoveryFor(null)}><X size={14}/></button></div><div className="pa-table-wrap"><table className="pa-table"><thead><tr><th>Kỳ lương</th><th>Số tiền</th><th>Trạng thái</th><th>Ghi chú</th><th></th></tr></thead><tbody>{recoveries.filter(r=>r.advance_id===recoveryFor.id).map(r=><tr key={r.id}><td>{periodLabel(periods.find(p=>p.id===r.period_id))}</td><td>{money(r.amount)}</td><td><span className={`pa-pill ${r.status==='CANCELLED'?'cancelled':r.status==='POSTED'?'active':'planned'}`}>{r.status==='CANCELLED'?'Đã hủy':r.status==='POSTED'?'Đã ghi nhận':'Dự kiến'}</span></td><td>{r.notes||'—'}</td><td><button className="pa-icon-btn danger" title="Hủy kế hoạch" disabled={r.status!=='PLANNED'} onClick={()=>cancelRecovery(r)}><Trash2 size={14}/></button></td></tr>)}{!recoveries.some(r=>r.advance_id===recoveryFor.id)&&<tr><td colSpan="5" className="pa-empty">Chưa có lịch sử thu hồi.</td></tr>}</tbody></table></div></div>}
      <div className="pa-note warning">Kế hoạch thu hồi được lưu riêng và chưa tự động khấu trừ vào lương. Chỉ tích hợp khấu trừ thực tế sau khi xác minh cấu trúc module TÍNH LƯƠNG để tránh ghi nhận trùng.</div>
    </>}

    {modal&&<div className="pa-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setModal(null)}}><div className="pa-modal" role="dialog" aria-modal="true"><div className="pa-modal-head"><div><h3>{modal==='adjustment'?(adjustmentForm.id?'Sửa khoản cộng/trừ':'Thêm khoản cộng/trừ'):modal==='advance'?(advanceForm.id?'Sửa hồ sơ tạm ứng':'Tạo khoản tạm ứng'):'Lập kế hoạch thu hồi tạm ứng'}</h3><p>Dữ liệu được lưu trực tiếp trên Supabase.</p></div><button className="pa-icon-btn" onClick={()=>setModal(null)} disabled={saving}><X size={15}/></button></div>
      {modal==='adjustment'&&<form onSubmit={saveAdjustment}><div className="pa-form-grid"><label>Kỳ lương<select value={adjustmentForm.period_id} onChange={e=>setAdjustmentForm(f=>({...f,period_id:e.target.value,employee_id:''}))} required><option value="">-- Chọn kỳ --</option>{periods.filter(p=>p.id===periodId&&p.status!=='CLOSED').map(p=><option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</select></label><label className="full">Nhân sự thuộc kỳ<select multiple value={adjustmentForm.id?[adjustmentForm.employee_id]:adjustmentForm.employee_ids} disabled={Boolean(adjustmentForm.id)} onChange={e=>setAdjustmentForm(f=>({...f,employee_ids:Array.from(e.target.selectedOptions).map(o=>o.value)}))} required size={Math.min(6,Math.max(3,eligibleEmployees.length))}>{eligibleEmployees.map(e=><option key={e.id} value={e.id}>{e.employee_code} · {e.employee_name}</option>)}</select><small>Giữ Ctrl để chọn nhiều nhân sự. Danh sách lấy từ nhân sự đã chốt của kỳ đang chọn.</small></label><label>Loại khoản<select value={adjustmentForm.kind} onChange={e=>setAdjustmentForm(f=>({...f,kind:e.target.value}))}><option value="ADD">Cộng</option><option value="DEDUCT">Trừ</option></select></label><label>Tên khoản<input value={adjustmentForm.name} onChange={e=>setAdjustmentForm(f=>({...f,name:e.target.value}))} required maxLength={160} placeholder="Nhập tên khoản"/></label><label>Dạng áp dụng<select value={adjustmentForm.application_type||'PER_PERIOD'} onChange={e=>setAdjustmentForm(f=>({...f,application_type:e.target.value}))}><option value="FIXED">Cố định</option><option value="PER_PERIOD">Theo kỳ</option></select></label><label>Số lượng<input type="number" min="0" step="any" value={adjustmentForm.quantity} onChange={e=>setAdjustmentForm(f=>({...f,quantity:e.target.value,amount:String((Number(e.target.value)||0)*(Number(f.unit_price)||0))}))} required/></label><label>Đơn vị tính<input value={adjustmentForm.unit} onChange={e=>setAdjustmentForm(f=>({...f,unit:e.target.value}))} maxLength={40} placeholder="Tháng, Ca, Ngày..."/></label><label>Đơn giá (VNĐ)<input type="number" min="0" step="any" value={adjustmentForm.unit_price} onChange={e=>setAdjustmentForm(f=>({...f,unit_price:e.target.value,amount:String((Number(f.quantity)||0)*(Number(e.target.value)||0))}))} required/></label><label>Thành tiền / Số tiền (VNĐ)<input type="number" value={String((Number(adjustmentForm.quantity)||0)*(Number(adjustmentForm.unit_price)||0))} readOnly/></label>{(adjustmentForm.application_type||'PER_PERIOD')==='FIXED'&&<><label>Áp dụng từ (YYYY-MM)<input type="month" value={adjustmentForm.effective_from||''} onChange={e=>setAdjustmentForm(f=>({...f,effective_from:e.target.value}))} required/></label><label>Áp dụng đến (không bắt buộc)<input type="month" value={adjustmentForm.effective_to||''} min={adjustmentForm.effective_from||undefined} onChange={e=>setAdjustmentForm(f=>({...f,effective_to:e.target.value}))}/></label></>}<label>Ngày ghi nhận<input type="date" value={adjustmentForm.effective_date} onChange={e=>setAdjustmentForm(f=>({...f,effective_date:e.target.value}))} required/></label><label>Trạng thái<select value={adjustmentForm.status} onChange={e=>setAdjustmentForm(f=>({...f,status:e.target.value}))}><option value="ACTIVE">Đang áp dụng</option><option value="CANCELLED">Đã hủy</option></select></label><label className="full">Ghi chú<input value={adjustmentForm.description} onChange={e=>setAdjustmentForm(f=>({...f,description:e.target.value}))} maxLength={1000}/></label></div><div className="pa-modal-actions"><button type="button" className="pa-btn" onClick={()=>setModal(null)} disabled={saving}>Hủy</button><button type="submit" className="pa-btn primary" disabled={saving}><Save size={14}/>{saving?'Đang lưu…':'Lưu khoản'}</button></div></form>}
      {modal==='advance'&&<form onSubmit={saveAdvance}><div className="pa-form-grid"><label>Nhân sự<select value={advanceForm.employee_id} onChange={e=>setAdvanceForm(f=>({...f,employee_id:e.target.value}))} required><option value="">-- Chọn nhân sự --</option>{allEmployeeOptions.map(e=><option key={e.id} value={e.id}>{e.employee_code} · {e.employee_name}</option>)}</select></label><label>Ngày tạm ứng<input type="date" value={advanceForm.advance_date} onChange={e=>setAdvanceForm(f=>({...f,advance_date:e.target.value}))} required/></label><label>Số tiền tạm ứng (VNĐ)<input type="number" min="1" step="1" value={advanceForm.amount} onChange={e=>setAdvanceForm(f=>({...f,amount:e.target.value}))} required/></label><label>Kỳ dự kiến bắt đầu thu hồi<select value={advanceForm.start_period_id} onChange={e=>setAdvanceForm(f=>({...f,start_period_id:e.target.value}))}><option value="">-- Chưa xác định --</option>{periods.filter(p=>p.type==='FIXED'&&p.status!=='CLOSED').map(p=><option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</select></label><label>Trạng thái<select value={advanceForm.status} onChange={e=>setAdvanceForm(f=>({...f,status:e.target.value}))}><option value="ACTIVE">Đang theo dõi</option><option value="CANCELLED">Đã hủy</option></select></label><label className="full">Nội dung / lý do<input value={advanceForm.description} onChange={e=>setAdvanceForm(f=>({...f,description:e.target.value}))} maxLength={1000}/></label></div><p className="pa-help">Tạo hồ sơ tạm ứng không tự xác nhận đã chi tiền và không tự khấu trừ vào lương.</p><div className="pa-modal-actions"><button type="button" className="pa-btn" onClick={()=>setModal(null)} disabled={saving}>Hủy</button><button type="submit" className="pa-btn primary" disabled={saving}><Save size={14}/>{saving?'Đang lưu…':'Lưu tạm ứng'}</button></div></form>}
      {modal==='recovery'&&<form onSubmit={saveRecovery}><div className="pa-form-grid"><label>Khoản tạm ứng<select value={recoveryForm.advance_id} onChange={e=>{const a=advances.find(x=>x.id===e.target.value);setRecoveryForm(f=>({...f,advance_id:e.target.value,amount:a?String(balance(a)) : ''}))}} required><option value="">-- Chọn khoản tạm ứng --</option>{advances.filter(a=>a.status==='ACTIVE'&&balance(a)>0).map(a=><option key={a.id} value={a.id}>{a.employee_code} · {a.employee_name} · Còn {money(balance(a))}</option>)}</select></label><label>Kỳ lương thu hồi<select value={recoveryForm.period_id} onChange={e=>setRecoveryForm(f=>({...f,period_id:e.target.value}))} required><option value="">-- Chọn kỳ --</option>{periods.filter(p=>p.type==='FIXED'&&p.status!=='CLOSED').map(p=><option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</select></label><label>Số tiền dự kiến thu hồi (VNĐ)<input type="number" min="1" step="1" value={recoveryForm.amount} onChange={e=>setRecoveryForm(f=>({...f,amount:e.target.value}))} required/></label><label>Ghi chú<input value={recoveryForm.notes} onChange={e=>setRecoveryForm(f=>({...f,notes:e.target.value}))} maxLength={1000}/></label></div><p className="pa-help">Chỉ tạo kế hoạch. Chưa cập nhật số tiền đã thu hồi và chưa trừ khỏi phiếu lương cho đến khi có tích hợp tính lương được kiểm thử.</p><div className="pa-modal-actions"><button type="button" className="pa-btn" onClick={()=>setModal(null)} disabled={saving}>Hủy</button><button type="submit" className="pa-btn primary" disabled={saving}><Save size={14}/>{saving?'Đang lưu…':'Lưu kế hoạch'}</button></div></form>}
    </div></div>}
  </section>;
}
