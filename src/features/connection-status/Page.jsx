import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Database, HardDrive, ShieldCheck, Cloud, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../shared/supabase.js';
import '../system-admin-modules.css';

const labels = { database:'Supabase Database', storage:'Supabase Storage', auth:'Supabase Auth', authorization:'Phân quyền Super Admin', google_apps_script:'Google Apps Script' };
const State = ({value}) => <span className={`sys-admin-state ${value==='OK'?'ok':value==='ERROR'?'bad':'warn'}`}>{value==='OK'?'Hoạt động':value==='ERROR'?'Lỗi':value==='NOT_CONFIGURED'?'Chưa cấu hình':'Đang kiểm tra'}</span>;

export default function Page() {
  const [data,setData]=useState(null), [loading,setLoading]=useState(false), [error,setError]=useState('');
  const run=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const {data:result,error:invokeError}=await supabase.functions.invoke('system-system-health',{body:{}});
      if(invokeError) throw invokeError;
      if(!result?.success) throw new Error(result?.error||'Không nhận được kết quả kiểm tra.');
      setData(result);
    } catch(e) { setError(e.message||'Không thể kiểm tra kết nối.'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{run();},[run]);
  const checks=data?.checks||{};
  const okCount=Object.values(checks).filter(x=>x.status==='OK').length;
  return <section className="sys-admin-page">
    <div className="sys-admin-head"><div><div className="sys-admin-eyebrow">GIÁM SÁT HẠ TẦNG</div><h2>Trạng thái kết nối</h2><p>Kiểm tra các dịch vụ đang phục vụ Web Lương Việt Âu.</p></div><button className="sys-admin-btn primary" onClick={run} disabled={loading}><RefreshCw size={15}/>{loading?'Đang kiểm tra…':'Kiểm tra lại'}</button></div>
    {error&&<div className="sys-admin-alert error"><AlertCircle size={17}/>{error}</div>}
    <div className="sys-admin-grid">
      <article className="sys-admin-card sys-admin-kpi"><span>Dịch vụ đang hoạt động</span><b>{data?`${okCount}/${Object.keys(checks).length}`:'—'}</b></article>
      <article className="sys-admin-card sys-admin-kpi"><span>Lần kiểm tra gần nhất</span><b style={{fontSize:15}}>{data?.checked_at?new Date(data.checked_at).toLocaleString('vi-VN'):'Chưa kiểm tra'}</b></article>
      <article className="sys-admin-card sys-admin-kpi"><span>Bản sao lưu gần nhất</span><b style={{fontSize:15}}>{data?.latest_backup?.status==='SUCCESS'?'Thành công':data?.latest_backup?.status||'Chưa có'}</b></article>
    </div>
    <div className="sys-admin-list">
      {Object.entries(labels).map(([key,label])=>{const item=checks[key];return <div className="sys-admin-row" key={key}><div><strong>{label}</strong><small>{item?.detail||'Chưa có dữ liệu kiểm tra.'}{item?.checked_at?` · ${new Date(item.checked_at).toLocaleTimeString('vi-VN')}`:''}</small></div><State value={item?.status||'PENDING'}/></div>;})}
    </div>
    <div className="sys-admin-note"><ShieldCheck size={15} style={{verticalAlign:'middle',marginRight:6}}/>Kết quả được kiểm tra trực tiếp từ máy chủ. Trạng thái “Hoạt động” chỉ xác nhận dịch vụ phản hồi tại thời điểm kiểm tra, không thay thế giám sát liên tục.</div>
  </section>;
}
