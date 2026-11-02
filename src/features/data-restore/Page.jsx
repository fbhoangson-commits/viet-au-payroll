import React,{useCallback,useEffect,useState} from 'react';
import {Archive,RefreshCw,ShieldCheck,AlertTriangle,Download,Lock,CheckCircle2} from 'lucide-react';
import {supabase} from '../../shared/supabase.js';
import '../system-admin-modules.css';
const bytes=v=>{const n=Number(v||0);if(!n)return '—';if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(2)} MB`;};
export default function Page(){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState(null);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const {data,error}=await supabase.from('system_backup_runs').select('id,created_at,finished_at,status,source,file_name,drive_file_id,size_bytes,checksum_sha256,table_count,row_count,error_message').order('created_at',{ascending:false}).limit(60);if(error)throw error;setRows(data||[]);}catch(e){setError(e.message||'Không tải được danh sách bản sao lưu.');}finally{setLoading(false);}},[]);
 useEffect(()=>{load();},[load]);
 const successes=rows.filter(x=>x.status==='SUCCESS');
 return <section className="sys-admin-page">
  <div className="sys-admin-head"><div><div className="sys-admin-eyebrow">AN TOÀN DỮ LIỆU</div><h2>Khôi phục dữ liệu</h2><p>Kiểm tra và chuẩn bị bản sao lưu trước khi thực hiện quy trình phục hồi.</p></div><button className="sys-admin-btn" onClick={load} disabled={loading}><RefreshCw size={15}/>Làm mới</button></div>
  <div className="sys-admin-grid"><article className="sys-admin-card sys-admin-kpi"><span>Tổng bản ghi backup</span><b>{rows.length}</b></article><article className="sys-admin-card sys-admin-kpi"><span>Bản sao lưu thành công</span><b>{successes.length}</b></article><article className="sys-admin-card sys-admin-kpi"><span>Bản lỗi</span><b>{rows.filter(x=>x.status==='FAILED').length}</b></article></div>
  {error&&<div className="sys-admin-alert error">{error}</div>}
  <div className="sys-admin-table-wrap"><table className="sys-admin-table"><thead><tr><th>Thời gian</th><th>Tên tệp</th><th>Dung lượng</th><th>Bảng / Dòng</th><th>Checksum</th><th>Trạng thái</th><th></th></tr></thead><tbody>
  {loading?<tr><td colSpan="7" className="sys-admin-empty">Đang tải…</td></tr>:!rows.length?<tr><td colSpan="7" className="sys-admin-empty">Chưa có bản sao lưu nào.</td></tr>:rows.map(r=><tr key={r.id}><td>{new Date(r.finished_at||r.created_at).toLocaleString('vi-VN')}<small>{r.source==='SCHEDULED'?'Tự động':'Thủ công'}</small></td><td><b>{r.file_name||'—'}</b>{r.error_message&&<small>{r.error_message}</small>}</td><td>{bytes(r.size_bytes)}</td><td>{r.table_count??'—'} / {Number(r.row_count||0).toLocaleString('vi-VN')}</td><td><small>{r.checksum_sha256?`${r.checksum_sha256.slice(0,16)}…`:'—'}</small></td><td><span className={`sys-admin-state ${r.status==='SUCCESS'?'ok':r.status==='FAILED'?'bad':'warn'}`}>{r.status}</span></td><td><button className="sys-admin-btn" disabled={r.status!=='SUCCESS'} onClick={()=>setSelected(r)}>Chi tiết</button></td></tr>)}
  </tbody></table></div>
  {selected&&<div className="sys-admin-card"><div className="sys-admin-head"><div><h3>Thông tin bản sao lưu</h3><p>{selected.file_name}</p></div><button className="sys-admin-btn" onClick={()=>setSelected(null)}>Đóng</button></div><p><b>Drive File ID:</b> {selected.drive_file_id||'Không có'}</p><p><b>SHA-256:</b> {selected.checksum_sha256||'Không có'}</p><p><b>Dung lượng:</b> {bytes(selected.size_bytes)}</p></div>}
  <div className="sys-admin-alert"><AlertTriangle size={18}/><div><b>Chưa bật thao tác ghi đè dữ liệu production.</b><br/>Bản backup hiện tại là snapshot JSON của schema public; chưa có quy trình tải file từ Drive, đối chiếu cấu trúc schema và phục hồi giao dịch có rollback. Vì vậy màn hình này chỉ cho phép kiểm tra lịch sử và metadata, không giả lập nút khôi phục. Không tự ý import SQL/JSON trực tiếp vào cơ sở dữ liệu đang chạy.</div></div>
  <div className="sys-admin-note"><Lock size={15} style={{verticalAlign:'middle',marginRight:6}}/>Muốn mở khôi phục thật cần bổ sung bước tải file từ Drive, xác minh SHA-256, kiểm tra tương thích schema, tạo điểm an toàn trước khôi phục và chạy transaction có kiểm soát. Bản này không thay đổi dữ liệu lương.</div>
 </section>;
}
