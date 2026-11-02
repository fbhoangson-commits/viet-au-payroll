import React,{useCallback,useEffect,useState} from 'react';
import {Mail,RefreshCw,ShieldCheck,CheckCircle2,AlertCircle,Info,Lock} from 'lucide-react';
import {supabase} from '../../shared/supabase.js';
import '../system-admin-modules.css';
export default function Page(){
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[checkedAt,setCheckedAt]=useState('');
 const check=useCallback(async()=>{setLoading(true);setError('');try{const {data,error}=await supabase.functions.invoke('system-system-health',{body:{}});if(error)throw error;if(!data?.success)throw new Error(data?.error||'Không kiểm tra được cổng email.');setStatus(data.checks?.google_apps_script||null);setCheckedAt(data.checked_at||new Date().toISOString());}catch(e){setError(e.message||'Không thể kiểm tra cổng email.');}finally{setLoading(false);}},[]);
 useEffect(()=>{check();},[check]);
 return <section className="sys-admin-page">
  <div className="sys-admin-head"><div><div className="sys-admin-eyebrow">DỊCH VỤ THƯ ĐIỆN TỬ</div><h2>Cấu hình email</h2><p>Thông tin gửi phiếu lương và trạng thái cổng Apps Script hiện tại.</p></div><button className="sys-admin-btn primary" onClick={check} disabled={loading}><RefreshCw size={15}/>{loading?'Đang kiểm tra…':'Kiểm tra kết nối'}</button></div>
  {error&&<div className="sys-admin-alert error"><AlertCircle size={16}/>{error}</div>}
  <div className="sys-admin-grid">
   <article className="sys-admin-card"><Mail size={20}/><h3>Địa chỉ gửi</h3><p><b>tckt@thptvietau.edu.vn</b></p></article>
   <article className="sys-admin-card"><ShieldCheck size={20}/><h3>Tên người gửi</h3><p><b>PHÒNG TÀI CHÍNH – TRƯỜNG THPT VIỆT ÂU</b></p></article>
   <article className="sys-admin-card"><Lock size={20}/><h3>Cơ chế gửi</h3><p>Google Apps Script / GmailApp. Token gửi thư được lưu trong Script Properties và Supabase Secrets, không hiển thị trên trình duyệt.</p></article>
  </div>
  <div className="sys-admin-list">
   <div className="sys-admin-row"><div><strong>Cổng Google Apps Script</strong><small>{status?.detail||'Đang chờ kiểm tra.'}{checkedAt?` · ${new Date(checkedAt).toLocaleString('vi-VN')}`:''}</small></div><span className={`sys-admin-state ${status?.status==='OK'?'ok':status?.status==='ERROR'?'bad':'warn'}`}>{status?.status==='OK'?'Hoạt động':status?.status==='ERROR'?'Lỗi':'Chưa xác định'}</span></div>
   <div className="sys-admin-row"><div><strong>Gửi phiếu lương</strong><small>Giữ nguyên luồng gửi hiện tại; không thay đổi PAYROLL_GAS_TOKEN, hàng đợi email hoặc mẫu phiếu lương.</small></div><span className="sys-admin-state warn">Không thay đổi</span></div>
  </div>
  <div className="sys-admin-alert"><Info size={18}/><div><b>Phạm vi cấu hình ở phiên bản này là kiểm tra và hiển thị.</b><br/>Thông tin xác thực gửi email đang được quản lý trong Apps Script và Supabase Secrets. Không cho phép sửa token hoặc đổi tài khoản gửi trực tiếp trên giao diện để tránh làm gián đoạn chức năng gửi phiếu lương đang hoạt động.</div></div>
  <div className="sys-admin-note">Muốn đổi địa chỉ gửi hoặc tên hiển thị, cần cập nhật đồng bộ ở Apps Script và kiểm thử gửi thư trước khi áp dụng production. Không nhập mật khẩu Gmail hoặc token vào trang này.</div>
 </section>;
}
