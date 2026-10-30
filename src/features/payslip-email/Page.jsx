import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, RefreshCw, Search, Send, ShieldCheck, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../shared/supabase.js';
import { buildPayslipEmailHtml } from '../payslips/Page.jsx';

const clean = v => String(v ?? '').trim();
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const money = v => v === null || v === undefined || v === '' ? '—' : `${num(v).toLocaleString('vi-VN',{maximumFractionDigits:0})} ₫`;
const dateTime = v => v ? new Date(v).toLocaleString('vi-VN') : '—';
const codeOf = r => clean(r?.employee_code || r?.employee_code_snapshot || r?.code);
const nameOf = r => clean(r?.employee_name || r?.employee_name_snapshot || r?.full_name || r?.name || codeOf(r) || 'Chưa có tên');
const emailOf = r => clean(r?.email || r?.employee_email || '');
const official = r => ['APPROVED','LOCKED'].includes(clean(r?.status).toUpperCase());
const statusText = v => ({DRAFT:'Bản nháp',PENDING:'Chờ duyệt',SUBMITTED:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Từ chối',LOCKED:'Đã khóa'}[clean(v).toUpperCase()] || v || 'Chưa xác định');
const getRows = s => { if(Array.isArray(s))return s; for(const k of ['results','rows','employees','payroll_results','employee_results','details'])if(Array.isArray(s?.[k]))return s[k]; return []; };
const periodName = p => clean(p?.name || p?.code || p?.period_code || p?.month || 'Kỳ lương');
// Chuẩn hóa nhãn kỳ lương để banner/email hiển thị đúng dạng T09/2026,
// kể cả khi dữ liệu có NBSP, ký tự zero-width hoặc tiền tố Lương viết hoa/thường.
const periodDisplayName = value => {
  const normalized = clean(value)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  // Chuẩn hóa kỳ lương theo định dạng duy nhất TMM/YYYY.
  // Không phụ thuộc period.name có tiền tố "Lương", "Kỳ lương" hay dấu phân cách.
  const match = normalized.match(/\bT\s*0?(\d{1,2})\s*[\/-]\s*(\d{4})\b/i);
  if (match) {
    const month = Number(match[1]);
    if (month >= 1 && month <= 12) return `T${String(month).padStart(2, '0')}/${match[2]}`;
  }

  // Dự phòng cho nhãn kỳ không theo dạng TMM/YYYY.
  return normalized
    .replace(/^\s*(?:kỳ\s+)?lương\s*[:：-]?\s*/i, '')
    .trim() || normalized;
};
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const buildEmailMessage = ({row,period}) => {
  const employeeName = nameOf(row);
  const employeeCode = codeOf(row);
  const periodLabel = periodName(period);
  const displayPeriod = periodDisplayName(periodLabel);
  const subject = `[VIỆT ÂU] PHIẾU LƯƠNG ${displayPeriod} – ${employeeName}`;
  const gross = money(row?.gross_income);
  const net = money(row?.net_pay);
  const htmlBody = `
  <div style="margin:0;padding:28px 12px;background:#f3f7fa;font-family:Arial,Helvetica,sans-serif;color:#17324a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce6ee;border-radius:12px;overflow:hidden;">
      <div style="padding:22px 28px;background:#10324d;color:#ffffff;">
        <div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#8fe0d5;">TRƯỜNG THPT VIỆT ÂU</div>
        <div style="font-size:21px;line-height:1.35;font-weight:700;margin-top:8px;">PHIẾU LƯƠNG<br/><span style="display:block;font-size:16px;line-height:1.45;font-weight:600;margin-top:4px;">${esc(periodLabel)}</span></div>
      </div>
      <div style="padding:26px 28px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Kính gửi Thầy/Cô <strong>${esc(employeeName)}</strong>,</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.7;">Trường THPT Việt Âu gửi Thầy/Cô phiếu lương ${esc(displayPeriod)}. Thông tin tổng hợp được trình bày dưới đây; phiếu lương chi tiết được đính kèm dưới dạng PDF.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:14px;">
          <tr><td style="padding:11px 13px;background:#f2f6f9;border:1px solid #e0e8ef;color:#5e7488;width:42%;">Mã nhân viên</td><td style="padding:11px 13px;border:1px solid #e0e8ef;font-weight:700;">${esc(employeeCode)}</td></tr>
          <tr><td style="padding:11px 13px;background:#f2f6f9;border:1px solid #e0e8ef;color:#5e7488;">Tổng thu nhập</td><td style="padding:11px 13px;border:1px solid #e0e8ef;font-weight:700;">${esc(gross)}</td></tr>
          <tr><td style="padding:13px;background:#eaf6f3;border:1px solid #d4e9e3;color:#17645b;font-weight:700;">Thực lĩnh</td><td style="padding:13px;border:1px solid #d4e9e3;color:#087957;font-size:17px;font-weight:800;">${esc(net)}</td></tr>
        </table>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.7;">Vui lòng xem file PDF đính kèm để kiểm tra đầy đủ các khoản thu nhập, khấu trừ và thông tin chi tiết của phiếu lương.</p>
        <p style="margin:0;font-size:14px;line-height:1.7;">Trân trọng,<br><strong style="color:#10324d;">TRƯỜNG THPT VIỆT ÂU</strong><br><span style="color:#0b8885;font-style:italic;">Be your best self.</span></p>
      </div>
      <div style="padding:13px 28px;background:#f7fafc;border-top:1px solid #e5edf2;color:#8293a2;font-size:11px;line-height:1.5;">Email được gửi tự động từ hệ thống quản trị tiền lương Việt Âu. Vui lòng không trả lời email này.</div>
    </div>
  </div>`;
  const textBody = `Kính gửi Thầy/Cô ${employeeName},\n\nTrường THPT Việt Âu gửi Thầy/Cô phiếu lương ${displayPeriod}.\n\nMã nhân viên: ${employeeCode}\nTổng thu nhập: ${gross}\nThực lĩnh: ${net}\n\nVui lòng xem file PDF đính kèm để kiểm tra đầy đủ các khoản thu nhập, khấu trừ và thông tin chi tiết của phiếu lương.\n\nTrân trọng,\nTRƯỜNG THPT VIỆT ÂU\nBe your best self.`;
  return {subject,html_body:htmlBody,text_body:textBody};
};

export default function Page(){
  const [periods,setPeriods]=useState([]),[runs,setRuns]=useState([]),[employees,setEmployees]=useState([]),[history,setHistory]=useState([]),[payrollData,setPayrollData]=useState({adjustments:[],approvals:[],groups:[],columns:[],rates:[],teaching:[]});
  const [periodId,setPeriodId]=useState(''),[runId,setRunId]=useState(''),[classification,setClassification]=useState('ALL'),[department,setDepartment]=useState('ALL'),[emailStatus,setEmailStatus]=useState('ALL'),[search,setSearch]=useState('');
  const [selected,setSelected]=useState([]),[preview,setPreview]=useState(null),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[sending,setSending]=useState(false);
  const load=useCallback(async()=>{
    if(!supabase||!isSupabaseConfigured){setError('Supabase chưa được cấu hình.');setLoading(false);return;}
    setRefreshing(true);setError('');setNotice('');
    try{
      const [p,r,e,h,a,ap,g,c,v,t]=await Promise.all([
        supabase.from('payroll_periods').select('*').order('created_at',{ascending:false}),
        supabase.from('payroll_runs').select('*').order('created_at',{ascending:false}),
        supabase.from('employees').select('*').order('employee_code',{ascending:true,nullsFirst:false}),
        supabase.from('payroll_email_queue').select('id,batch_id,payroll_run_id,employee_id,employee_code,employee_name,recipient_email,period_label,status,attempts,last_error,sent_at,created_at').order('created_at',{ascending:false}).limit(200),
        supabase.from('payroll_adjustments').select('*').order('created_at',{ascending:false}),
        supabase.from('payroll_approvals').select('*').order('created_at',{ascending:false}),
        supabase.from('salary_rate_groups').select('*'),
        supabase.from('salary_rate_columns').select('*'),
        supabase.from('salary_rate_values').select('*'),
        supabase.from('teaching_attendance_records').select('*')
      ]);
      if(p.error)throw new Error(`Không tải được kỳ lương: ${p.error.message}`);
      if(r.error)throw new Error(`Không tải được phiên bản lương: ${r.error.message}`);
      if(e.error)throw new Error(`Không tải được Employee Master: ${e.error.message}`);
      if(h.error)throw new Error(`Không tải được lịch sử email: ${h.error.message}`);
      for(const [label,result] of [['Khoản cộng trừ',a],['Phê duyệt',ap],['Nhóm định mức',g],['Cột định mức',c],['Giá trị định mức',v],['Chấm tiết',t]])if(result.error)throw new Error(`Không tải được ${label}: ${result.error.message}`);
      setPeriods(p.data||[]);setRuns(r.data||[]);setEmployees(e.data||[]);setHistory(h.data||[]);setPayrollData({adjustments:a.data||[],approvals:ap.data||[],groups:g.data||[],columns:c.data||[],rates:v.data||[],teaching:t.data||[]});
      setPeriodId(old=>old&&(p.data||[]).some(x=>x.id===old)?old:((r.data||[]).find(official)?.payroll_period_id||(r.data||[])[0]?.payroll_period_id||(p.data||[])[0]?.id||''));
    }catch(err){setError(err?.message||String(err));}finally{setLoading(false);setRefreshing(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  const periodRuns=useMemo(()=>runs.filter(r=>r.payroll_period_id===periodId).sort((a,b)=>Number(b.run_number||0)-Number(a.run_number||0)||new Date(b.created_at||0)-new Date(a.created_at||0)),[runs,periodId]);
  useEffect(()=>{if(periodRuns.length&&!periodRuns.some(r=>r.id===runId))setRunId((periodRuns.find(official)||periodRuns[0]).id);else if(!periodRuns.length)setRunId('');},[periodRuns,runId]);
  const run=runs.find(r=>r.id===runId)||null,period=periods.find(p=>p.id===periodId)||null;
  const rows=useMemo(()=>getRows(run?.input_snapshot).slice().sort((a,b)=>codeOf(a).localeCompare(codeOf(b),'vi',{numeric:true,sensitivity:'base'})),[run]);
  const employeeById=useMemo(()=>new Map(employees.map(e=>[clean(e.id),e])),[employees]);
  const employeeByCode=useMemo(()=>new Map(employees.map(e=>[clean(e.employee_code).toUpperCase(),e])),[employees]);
  const joined=useMemo(()=>rows.map((r,i)=>{const emp=employeeById.get(clean(r.employee_id))||employeeByCode.get(codeOf(r).toUpperCase());return {...r,_key:clean(r.employee_id)||codeOf(r)||String(i),_email:emailOf(emp)||emailOf(r),_employee:emp||null};}),[rows,employeeById,employeeByCode]);
  const filtered=useMemo(()=>joined.filter(r=>{const q=clean(search).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const target=`${codeOf(r)} ${nameOf(r)}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const cls=clean(r.classification||r.employee_type);const dep=clean(r.department||r.department_name||r._employee?.department);const es=!r._email?'MISSING':validEmail(r._email)?'VALID':'INVALID';return(!q||target.includes(q))&&(classification==='ALL'||cls===classification)&&(department==='ALL'||dep===department)&&(emailStatus==='ALL'||emailStatus===es);}),[joined,search,classification,department,emailStatus]);
  const classifications=[...new Set(joined.map(r=>clean(r.classification||r.employee_type)).filter(Boolean))].sort();
  const departments=[...new Set(joined.map(r=>clean(r.department||r.department_name||r._employee?.department)).filter(Boolean))].sort();
  const selectedRows=filtered.filter(r=>selected.includes(r._key));
  const validCount=joined.filter(r=>validEmail(r._email)).length,missingCount=joined.length-validCount;
  const setOne=(key,checked)=>setSelected(old=>checked?[...new Set([...old,key])]:old.filter(x=>x!==key));
  const setVisible=checked=>setSelected(old=>checked?[...new Set([...old,...filtered.map(r=>r._key)])]:old.filter(k=>!filtered.some(r=>r._key===k)));
  const previewEmail=r=>{setPreview(r);setNotice('');};

  const sendSelected=async()=>{if(!run||!selectedRows.length)return;if(!official(run)){setNotice('Chỉ phiên bản đã duyệt hoặc đã khóa mới đủ điều kiện gửi.');return;}const eligible=selectedRows.filter(r=>validEmail(r._email)&&clean(r.employee_id||r._employee?.id));if(!eligible.length){setNotice('Không có nhân sự nào được chọn có email hợp lệ và mã nhân sự hợp lệ.');return;}if(!window.confirm(`Xác nhận tạo hàng đợi gửi ${eligible.length} email riêng biệt cho kỳ ${periodName(period)} · Run #${run.run_number}?`))return;
    setSending(true);setNotice('');try{const batchId=crypto.randomUUID();const items=eligible.map(r=>{const employeeId=clean(r.employee_id||r._employee?.id);const html=buildPayslipEmailHtml({run,period,row:r,adjustments:payrollData.adjustments,approvals:payrollData.approvals,rateGroups:payrollData.groups,rateColumns:payrollData.columns,rateValues:payrollData.rates,teachingRecords:payrollData.teaching});const safeCode=codeOf(r)||employeeId;const safePeriod=clean(period?.month||period?.code||period?.period_code||periodName(period)).replace(/[^0-9A-Za-z_-]/g,'_');const emailMessage=buildEmailMessage({row:r,period});return {employee_id:employeeId,html_base64:btoa(unescape(encodeURIComponent(html))),file_name:`PHIEU_LUONG_${safeCode}_${safePeriod}.pdf`,...emailMessage};});const result=await supabase.functions.invoke('bright-endpoint',{headers:{'x-idempotency-key':batchId},body:{period_id:periodId,run_id:run.id,period_label:periodDisplayName(periodName(period)),items}});if(result.error)throw result.error;const queued=result.data?.queued??0;const sent=await supabase.functions.invoke('process-payslip-email-queue',{body:{batch_id:batchId}});if(sent.error)throw sent.error;setNotice(`Đã xử lý hàng đợi: ${sent.data?.sent??0}/${queued} email gửi thành công. ${sent.data?.failed??0} email lỗi. Mở lịch sử gửi để xem chi tiết.`);await load();}catch(err){setNotice(`Chưa gửi được email: ${err?.message||String(err)}`);}finally{setSending(false);}};
  const retryFailed=async(batchId)=>{if(!batchId||!window.confirm('Gửi lại các email lỗi trong lô này? Email đã gửi thành công sẽ không bị gửi lại.'))return;setSending(true);setNotice('');try{const result=await supabase.functions.invoke('process-payslip-email-queue',{body:{batch_id:batchId,retry_failed:true}});if(result.error)throw result.error;setNotice(`Gửi lại hoàn tất: ${result.data?.sent??0} thành công, ${result.data?.failed??0} lỗi.`);await load();}catch(err){setNotice(`Không gửi lại được: ${err?.message||String(err)}`);}finally{setSending(false);}};
    const css=`.pe{padding:24px 26px;color:#17324a}.pe *{box-sizing:border-box}.pe-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.pe h1{font-size:25px;margin:4px 0;color:#102f49}.pe-sub,.pe-muted{font-size:12px;color:#72869a}.pe-btn{border:1px solid #cbd9e6;background:#fff;color:#173d5b;border-radius:8px;padding:9px 12px;display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-weight:700;font-size:12px}.pe-btn.primary{background:#0b8885;border-color:#0b8885;color:#fff}.pe-btn:disabled{opacity:.45;cursor:not-allowed}.pe-card{background:#fff;border:1px solid #d7e2ed;border-radius:12px;padding:15px;margin-bottom:14px}.pe-filters{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:12px}.pe-field label{display:block;font-size:11px;font-weight:700;color:#627a90;margin-bottom:6px}.pe-field select,.pe-field input{width:100%;height:38px;border:1px solid #cddbe8;border-radius:8px;padding:0 10px;background:#fff;color:#15314a;min-width:0}.pe-search{position:relative}.pe-search svg{position:absolute;left:10px;top:11px;color:#8296a9}.pe-search input{padding-left:32px}.pe-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}.pe-kpi{border:1px solid #d8e3ed;background:#fff;border-radius:10px;padding:12px}.pe-kpi span{display:block;font-size:10px;color:#72879a;margin-bottom:7px}.pe-kpi b{font-size:20px;color:#143d5c}.pe-banner{padding:12px 14px;border:1px solid #cce9e0;background:#f0faf7;color:#235a5c;border-radius:9px;margin-bottom:14px;font-size:12px}.pe-banner.warn{border-color:#f2dfaa;background:#fff8e9;color:#775917}.pe-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.pe-table-wrap{overflow:auto;border:1px solid #d7e2ed;border-radius:10px}.pe-table{border-collapse:collapse;width:100%;min-width:1050px;font-size:12px}.pe-table th{background:#f1f6fa;color:#60778d;text-align:left;font-size:11px;white-space:nowrap}.pe-table th,.pe-table td{padding:10px;border-bottom:1px solid #e3ebf2}.pe-table td.num{text-align:right;white-space:nowrap}.pe-pill{display:inline-block;border-radius:20px;padding:4px 8px;font-size:10px;font-weight:750;background:#eef2f6;color:#667b8e}.pe-pill.good{background:#dff6ee;color:#087957}.pe-pill.bad{background:#ffe3e0;color:#ad3027}.pe-pill.warn{background:#fff0ce;color:#8c6410}.pe-empty{text-align:center;padding:36px;color:#71869a}.pe-modal-bg{position:fixed;inset:0;background:#0b223a88;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}.pe-modal{width:min(720px,96vw);max-height:90vh;overflow:auto;background:white;border-radius:14px;padding:22px}.pe-modal-head{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e0e8ef;padding-bottom:12px}.pe-preview{background:#f6f9fb;border:1px solid #dce6ee;border-radius:9px;padding:14px;margin:14px 0;white-space:pre-line;line-height:1.65}.pe-actions{display:flex;gap:6px;white-space:nowrap}@media(max-width:1050px){.pe-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.pe-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){.pe{padding:16px}.pe-filters{grid-template-columns:1fr 1fr}.pe-kpis{grid-template-columns:1fr 1fr}.pe-head{display:block}}`;
  return <div className="pe"><style>{css}</style>
    <div className="pe-head"><div><div style={{fontSize:10,fontWeight:800,letterSpacing:1,color:'#078f91'}}>✦ WORKSPACE · PAYROLL</div><h1>Gửi email phiếu lương</h1><div className="pe-sub">Gửi phiếu lương PDF riêng cho từng nhân sự và theo dõi kết quả gửi.</div></div><button className="pe-btn" onClick={load} disabled={refreshing}><RefreshCw size={15}/>{refreshing?'Đang tải…':'Làm mới'}</button></div>
    {error&&<div className="pe-banner warn"><AlertTriangle size={16}/> {error}</div>}
    <div className="pe-banner"><ShieldCheck size={17} style={{verticalAlign:'middle',marginRight:7}}/><b>Nguyên tắc bảo mật:</b> Dữ liệu lương lấy từ đúng Snapshot đã lưu; email lấy từ Employee Master. Chỉ phiên bản đã duyệt/đã khóa mới đủ điều kiện gửi.</div>
    <div className="pe-card"><div className="pe-filters">
      <div className="pe-field"><label>Kỳ lương</label><select value={periodId} onChange={e=>{setPeriodId(e.target.value);setSelected([]);}}><option value="">Chọn kỳ lương</option>{periods.map(p=><option key={p.id} value={p.id}>{periodName(p)}</option>)}</select></div>
      <div className="pe-field"><label>Phiên bản lương</label><select value={runId} onChange={e=>{setRunId(e.target.value);setSelected([]);}}><option value="">Chọn phiên bản</option>{periodRuns.map(r=><option key={r.id} value={r.id}>Run #{r.run_number} · {statusText(r.status)} · {dateTime(r.calculated_at||r.created_at)}</option>)}</select></div>
      <div className="pe-field"><label>Phân loại nhân sự</label><select value={classification} onChange={e=>setClassification(e.target.value)}><option value="ALL">Tất cả phân loại</option>{classifications.map(v=><option key={v}>{v}</option>)}</select></div>
      <div className="pe-field"><label>Phòng ban</label><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="ALL">Tất cả phòng ban</option>{departments.map(v=><option key={v}>{v}</option>)}</select></div>
      <div className="pe-field"><label>Tìm nhân sự</label><div className="pe-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mã nhân viên hoặc họ tên…"/></div></div>
      <div className="pe-field"><label>Trạng thái email</label><select value={emailStatus} onChange={e=>setEmailStatus(e.target.value)}><option value="ALL">Tất cả</option><option value="VALID">Email hợp lệ</option><option value="MISSING">Chưa có email</option><option value="INVALID">Email không hợp lệ</option></select></div>
    </div></div>
    <div className="pe-kpis">{[['Nhân sự trong Snapshot',joined.length],['Email hợp lệ',validCount],['Chưa có email',missingCount],['Đang chọn',selected.length],['Đủ điều kiện gửi',selectedRows.filter(r=>validEmail(r._email)).length]].map(([k,v])=><div className="pe-kpi" key={k}><span>{k}</span><b>{v.toLocaleString('vi-VN')}</b></div>)}</div>
    {run&&<div className={`pe-banner ${official(run)?'':'warn'}`}><b>{periodName(period)} · Run #{run.run_number} · {statusText(run.status)}</b><br/>Mã kỳ: {period?.code||period?.period_code||run.payroll_period_id} · Thời điểm tính: {dateTime(run.calculated_at||run.created_at)} · {joined.length} nhân sự trong Snapshot.{!official(run)&&' Phiên bản này chưa đủ điều kiện gửi email.'}</div>}
    {notice&&<div className="pe-banner warn">{notice}</div>}
    <div className="pe-card" style={{padding:0,overflow:'hidden'}}><div className="pe-toolbar" style={{padding:'14px 16px'}}><div><b>Danh sách nhân sự nhận phiếu lương</b><div className="pe-muted">Email được đối chiếu theo Employee Master · Mỗi nhân sự nhận một email riêng</div></div><div className="pe-actions"><button className="pe-btn" onClick={()=>setVisible(true)} disabled={!filtered.length}>Chọn danh sách đang lọc</button><button className="pe-btn" onClick={()=>setVisible(false)} disabled={!selected.length}>Bỏ chọn</button><button className="pe-btn primary" onClick={sendSelected} disabled={sending||!official(run)||!selectedRows.some(r=>validEmail(r._email))}><Send size={14}/>{sending?'Đang xử lý…':'Gửi email đã chọn'}</button></div></div>
      {loading?<div className="pe-empty">Đang tải dữ liệu từ Supabase…</div>:!run?<div className="pe-empty">Chưa có phiên bản lương. Hãy lưu kỳ lương tại Tính Lương trước.</div>:!joined.length?<div className="pe-empty">Phiên bản này không có danh sách nhân sự trong Snapshot.</div>:!filtered.length?<div className="pe-empty">Không tìm thấy nhân sự phù hợp bộ lọc.</div>:<div className="pe-table-wrap"><table className="pe-table"><thead><tr><th><input type="checkbox" checked={filtered.length>0&&filtered.every(r=>selected.includes(r._key))} onChange={e=>setVisible(e.target.checked)}/></th><th>Mã NV</th><th>Họ và tên</th><th>Phân loại</th><th>Phòng ban</th><th>Email nhận</th><th style={{textAlign:'right'}}>Thực lĩnh</th><th>Trạng thái email</th><th>Thao tác</th></tr></thead><tbody>{filtered.map(r=>{const valid=validEmail(r._email);return <tr key={r._key}><td><input type="checkbox" checked={selected.includes(r._key)} onChange={e=>setOne(r._key,e.target.checked)}/></td><td><b>{codeOf(r)||'—'}</b></td><td>{nameOf(r)}</td><td>{r.classification||r.employee_type||'—'}</td><td>{r.department||r.department_name||r._employee?.department||'—'}</td><td>{r._email||'Chưa có email'}</td><td className="num">{money(r.net_pay)}</td><td><span className={`pe-pill ${valid?'good':'bad'}`}>{valid?'Email hợp lệ':r._email?'Email không hợp lệ':'Chưa có email'}</span></td><td><button className="pe-btn" onClick={()=>previewEmail(r)}><Eye size={14}/> Xem trước</button></td></tr>;})}</tbody></table></div>}
    </div>
    <div className="pe-banner warn"><AlertTriangle size={16} style={{verticalAlign:'middle',marginRight:6}}/><b>Điều kiện triển khai:</b> cần áp dụng migration hàng đợi, deploy hai Edge Function và cấu hình hai Supabase secrets theo README của bản vá trước khi gửi thật.</div>
    <div className="pe-card"><div className="pe-toolbar"><div><b>Lịch sử gửi email</b><div className="pe-muted">Tối đa 200 lượt gần nhất · chống gửi trùng theo nhân sự và phiên bản lương</div></div><span className="pe-pill">{history.length} bản ghi</span></div>{!history.length?<div className="pe-empty">Chưa có lịch sử gửi email.</div>:<div className="pe-table-wrap" style={{marginTop:12}}><table className="pe-table"><thead><tr><th>Thời điểm</th><th>Mã NV</th><th>Họ và tên</th><th>Email</th><th>Kỳ lương</th><th>Trạng thái</th><th>Lỗi gần nhất</th><th>Thao tác</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{dateTime(h.sent_at||h.created_at)}</td><td>{h.employee_code||'—'}</td><td>{h.employee_name||'—'}</td><td>{h.recipient_email}</td><td>{h.period_label}</td><td><span className={`pe-pill ${h.status==='SENT'?'good':h.status==='FAILED'?'bad':'warn'}`}>{({QUEUED:'Đang chờ',SENDING:'Đang gửi',SENT:'Đã gửi',FAILED:'Gửi lỗi',NEEDS_REVIEW:'Cần kiểm tra'})[h.status]||h.status}</span></td><td>{h.last_error||'—'}</td><td>{h.status==='FAILED'?<button className="pe-btn" disabled={sending} onClick={()=>retryFailed(h.batch_id)}>Gửi lại lô lỗi</button>:'—'}</td></tr>)}</tbody></table></div>}</div>
    {preview&&<div className="pe-modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)setPreview(null);}}><div className="pe-modal" role="dialog" aria-modal="true" aria-label="Xem trước email phiếu lương"><div className="pe-modal-head"><div><div style={{fontSize:10,color:'#078f91',fontWeight:800}}>XEM TRƯỚC EMAIL</div><h2 style={{margin:'5px 0',fontSize:20}}>{nameOf(preview)} · {codeOf(preview)}</h2><div className="pe-muted">{periodName(period)} · Run #{run?.run_number}</div></div><button className="pe-btn" onClick={()=>setPreview(null)}><X size={16}/> Đóng</button></div><div className="pe-preview"><b>Người nhận:</b> {preview._email||'Chưa có email'}<br/><b>Tiêu đề:</b> [VIỆT ÂU] PHIẾU LƯƠNG {periodDisplayName(periodName(period))} – {nameOf(preview)}<br/><br/>Kính gửi Thầy/Cô {nameOf(preview)},<br/><br/>Trường THPT Việt Âu gửi Thầy/Cô phiếu lương {periodDisplayName(periodName(period))}.<br/><br/>Mã nhân viên: {codeOf(preview)}<br/>Tổng thu nhập: {money(preview.gross_income)}<br/>Thực lĩnh: {money(preview.net_pay)}<br/><br/>Phiếu lương chi tiết được tạo từ đúng mẫu phiếu lương của hệ thống và đính kèm dưới dạng PDF.<br/><br/>Trân trọng,<br/><b>TRƯỜNG THPT VIỆT ÂU</b><br/>Be your best self.</div><div className="pe-toolbar"><span className={`pe-pill ${validEmail(preview._email)?'good':'bad'}`}>{validEmail(preview._email)?'Email hợp lệ':'Không thể gửi: email chưa hợp lệ'}</span><span className="pe-muted">File dự kiến đính kèm: PHIEU_LUONG_{codeOf(preview)}_{String(period?.month||period?.code||period?.period_code||periodName(period)).replace(/[^0-9A-Za-z_-]/g,'_')}.pdf · PDF được tạo khi gửi</span></div></div></div>}
  </div>;
}
