import React,{useCallback,useEffect,useState} from 'react';
import {ShieldCheck,RefreshCw,Users,Activity,KeyRound,AlertTriangle,CheckCircle2,Lock} from 'lucide-react';
import {supabase} from '../../shared/supabase.js';
import '../system-admin-modules.css';
export default function Page(){
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[user,setUser]=useState(null),[role,setRole]=useState(''),[profile,setProfile]=useState(null),[logs,setLogs]=useState([]);
 const load=useCallback(async()=>{setLoading(true);setError('');try{
  const {data:{user:me},error:userErr}=await supabase.auth.getUser();if(userErr)throw userErr;if(!me)throw new Error('Phiên đăng nhập không hợp lệ.');
  const [{data:roleRows,error:roleErr},{data:profileRow,error:profileErr},{data:logRows,error:logErr}]=await Promise.all([
   supabase.from('system_user_roles').select('system_roles(code,name)').eq('user_id',me.id),
   supabase.from('system_user_profiles').select('display_name,is_active,updated_at').eq('user_id',me.id).maybeSingle(),
   supabase.from('system_activity_logs').select('created_at,actor_email,module,action,description').order('created_at',{ascending:false}).limit(12)
  ]);
  if(roleErr)throw roleErr;if(profileErr)throw profileErr;if(logErr)throw logErr;
  setUser(me);setRole(roleRows?.map(x=>x.system_roles?.name||x.system_roles?.code).filter(Boolean).join(', ')||'Chưa cấp vai trò');setProfile(profileRow);setLogs(logRows||[]);
 }catch(e){setError(e.message||'Không tải được thông tin bảo mật.');}finally{setLoading(false);}},[]);
 useEffect(()=>{load();},[load]);
 return <section className="sys-admin-page">
  <div className="sys-admin-head"><div><div className="sys-admin-eyebrow">KIỂM SOÁT TRUY CẬP</div><h2>Bảo mật hệ thống</h2><p>Thông tin phiên đăng nhập, vai trò và các sự kiện quản trị gần đây.</p></div><button className="sys-admin-btn" onClick={load} disabled={loading}><RefreshCw size={15}/>Làm mới</button></div>
  {error&&<div className="sys-admin-alert error">{error}</div>}
  <div className="sys-admin-grid">
   <article className="sys-admin-card sys-admin-kpi"><Users/><span>Tài khoản hiện tại</span><b style={{fontSize:15}}>{profile?.display_name||user?.email||'—'}</b></article>
   <article className="sys-admin-card sys-admin-kpi"><ShieldCheck/><span>Vai trò</span><b style={{fontSize:15}}>{role||'—'}</b></article>
   <article className="sys-admin-card sys-admin-kpi"><Activity/><span>Sự kiện quản trị gần đây</span><b>{logs.length}</b></article>
  </div>
  <div className="sys-admin-list">
   <div className="sys-admin-row"><div><strong>Xác thực phiên</strong><small>{user?.email||'Đang kiểm tra phiên đăng nhập'}</small></div><span className={`sys-admin-state ${user?'ok':'warn'}`}>{user?'Đã xác thực':'Chưa xác định'}</span></div>
   <div className="sys-admin-row"><div><strong>Trạng thái tài khoản</strong><small>{profile?.is_active===false?'Tài khoản đang bị khóa':'Hồ sơ người dùng đang hoạt động hoặc chưa có cờ khóa.'}</small></div><span className={`sys-admin-state ${profile?.is_active===false?'bad':'ok'}`}>{profile?.is_active===false?'Đã khóa':'Đang hoạt động'}</span></div>
   <div className="sys-admin-row"><div><strong>Đổi mật khẩu</strong><small>Thực hiện qua menu tài khoản ở góc trên bên phải. Mật khẩu tối thiểu 10 ký tự.</small></div><span className="sys-admin-state ok">Có sẵn</span></div>
   <div className="sys-admin-row"><div><strong>Phân quyền quản trị</strong><small>Edge Function kiểm tra SUPER_ADMIN ở máy chủ; không chỉ dựa vào việc ẩn menu.</small></div><span className="sys-admin-state ok">Có kiểm tra máy chủ</span></div>
  </div>
  <div className="sys-admin-head"><div><h3>Sự kiện quản trị gần đây</h3><p>12 sự kiện mới nhất mà tài khoản hiện tại được phép xem.</p></div></div>
  <div className="sys-admin-table-wrap"><table className="sys-admin-table"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Module</th><th>Hành động</th><th>Mô tả</th></tr></thead><tbody>{loading?<tr><td colSpan="5" className="sys-admin-empty">Đang tải…</td></tr>:!logs.length?<tr><td colSpan="5" className="sys-admin-empty">Chưa có sự kiện.</td></tr>:logs.map((x,i)=><tr key={`${x.created_at}-${i}`}><td>{new Date(x.created_at).toLocaleString('vi-VN')}</td><td>{x.actor_email||'Hệ thống'}</td><td>{x.module}</td><td><b>{x.action}</b></td><td>{x.description||'—'}</td></tr>)}</tbody></table></div>
  <div className="sys-admin-alert"><AlertTriangle size={18}/><div><b>Không hiển thị hoặc thay đổi bí mật hệ thống.</b><br/>API keys, Service Role Key, token Apps Script và BACKUP_SECRET không được đọc ra trình duyệt. Đây là nguyên tắc bảo mật bắt buộc.</div></div>
  <div className="sys-admin-note"><Lock size={15} style={{verticalAlign:'middle',marginRight:6}}/>Màn hình này là bảng kiểm tra quản trị, không thay thế kiểm thử xâm nhập hoặc đánh giá cấu hình bảo mật toàn diện.</div>
 </section>;
}
