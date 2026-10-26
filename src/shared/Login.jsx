import React, { useState } from 'react';
import { LockKeyhole, Mail, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!isSupabaseConfigured) {
      setError('Chưa cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trên Cloudflare Pages.');
      return;
    }
    setBusy(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });
      if (authError) throw authError;
      if (!data.session || !data.user) throw new Error('Đăng nhập chưa tạo được phiên làm việc.');
      onLogin(data.session);
    } catch (e) {
      setError(e?.message === 'Invalid login credentials'
        ? 'Email hoặc mật khẩu chưa chính xác.'
        : (e?.message || 'Không thể đăng nhập. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen">
    <section className="login-card">
      <div className="login-brand"><img src="/logo-viet-au.png" alt="Logo Việt Âu" /></div>
      <div className="login-eyebrow"><ShieldCheck size={14}/> HỆ THỐNG NỘI BỘ</div>
      <h1>Đăng nhập</h1>
      <p className="login-subtitle">VIỆT ÂU PAYROLL SYSTEM</p>
      <form onSubmit={submit} className="login-form">
        <label htmlFor="login-email">Email tài khoản</label>
        <div className="login-input-wrap"><Mail size={17}/><input id="login-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Nhập email đã được cấp" /></div>
        <label htmlFor="login-password">Mật khẩu</label>
        <div className="login-input-wrap"><LockKeyhole size={17}/><input id="login-password" type={showPassword?'text':'password'} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập mật khẩu"/><button type="button" className="login-show-password" aria-label={showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
        {error && <div className="login-error"><AlertCircle size={16}/><span>{error}</span></div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy?'ĐANG XÁC THỰC…':'ĐĂNG NHẬP HỆ THỐNG'}</button>
      </form>
      <div className="login-footnote">Tài khoản được xác thực qua hệ thống bảo mật Supabase.</div>
    </section>
    <div className="login-copyright">TRƯỜNG THPT VIỆT ÂU · BE YOUR BEST SELF</div>
  </main>;
}
