import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Bell, ChevronDown, ChevronRight, Menu as MenuIcon, X, Command, Sparkles, KeyRound, UserRound, LogOut, Check, Eye, EyeOff } from 'lucide-react';
import { NAV_GROUPS } from './app/navigation.js';
import Login from './shared/Login.jsx';
import { supabase, isSupabaseConfigured } from './shared/supabase.js';
import './styles.css';

const pages = import.meta.glob('./features/*/Page.jsx', { eager: true, import: 'default' });
const allItems = NAV_GROUPS.flatMap(group => group.items.map(item => ({ ...item, group: group.title })));
function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileRoleCode, setProfileRoleCode] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const resolvePath = (path) => { const slug = String(path || '/').replace(/^\/+|\/+$/g, '') || 'dashboard'; return allItems.some(item => item.slug === slug) ? slug : 'dashboard'; };
  const [active, setActive] = useState(() => resolvePath(window.location.pathname));
  const [expanded, setExpanded] = useState(['TỔNG QUAN']);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  React.useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { setAuthReady(true); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setAuthError(error.message);
      setSession(data?.session ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) { setSession(nextSession); setAuthReady(true); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);
  React.useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    let alive = true;
    (async () => {
      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase.from('system_user_profiles').select('display_name').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('system_user_roles').select('system_roles(code,name)').eq('user_id', session.user.id)
      ]);
      if (!alive) return;
      setProfileName(profile?.display_name || session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || '');
      const role = roleRows?.[0]?.system_roles;
      setProfileRole(role?.name || '');
      setProfileRoleCode(role?.code || '');
      const force = session.user.app_metadata?.must_change_password === true;
      setMustChangePassword(force);
      if (force) setPasswordModal(true);
    })();
    return () => { alive = false; };
  }, [session?.user?.id]);
  const savePassword = async (e) => {
    e.preventDefault(); setPasswordError('');
    if (newPassword.length < 10) return setPasswordError('Mật khẩu mới phải có ít nhất 10 ký tự.');
    if (newPassword !== confirmPassword) return setPasswordError('Mật khẩu xác nhận không khớp.');
    setPasswordBusy(true);
    try {
      if (!mustChangePassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: oldPassword });
        if (verifyError) throw new Error('Mật khẩu hiện tại không chính xác.');
      }
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const { error: flagError } = await supabase.functions.invoke('system-admin-users', { body: { action: 'complete_password_change' } });
      if (flagError) throw flagError;
      const { data: refreshed } = await supabase.auth.refreshSession();
      setSession(refreshed?.session || (current => current));
      setMustChangePassword(false); setPasswordModal(false); setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      alert('Đã cập nhật mật khẩu thành công.');
    } catch (err) { setPasswordError(err.message || 'Không thể đổi mật khẩu.'); }
    finally { setPasswordBusy(false); }
  };
  const isSuperAdmin = profileRoleCode === 'SUPER_ADMIN';
  const isPayrollAccountant = profileRoleCode === 'PAYROLL_ACCOUNTANT';
  const canSeeNavItem = (item, group) => {
    if (isSuperAdmin || !isPayrollAccountant) return true;
    if (group.title === 'QUẢN LÝ HỆ THỐNG') return item.slug === 'activity-log';
    if (group.title === 'CẤU HÌNH LƯƠNG') return false;
    return true;
  };
  const visibleNavGroups = useMemo(
    () => NAV_GROUPS
      .map(group => ({ ...group, items: group.items.filter(item => canSeeNavItem(item, group)) }))
      .filter(group => group.items.length),
    [profileRoleCode]
  );
  const visibleItems = visibleNavGroups.flatMap(group => group.items.map(item => ({ ...item, group: group.title })));
  const current = visibleItems.find(item => item.slug === active) || visibleItems[0];
  const Page = pages[`./features/${current?.slug || 'dashboard'}/Page.jsx`] || pages['./features/dashboard/Page.jsx'];
  const filtered = useMemo(
    () => visibleNavGroups
      .map(group => ({...group, items: group.items.filter(item => `${item.label} ${group.title}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))}))
      .filter(group => group.items.length),
    [query, profileRoleCode]
  );
  React.useEffect(() => {
    if (!profileRoleCode) return;
    const visible = NAV_GROUPS.flatMap(group => group.items.filter(item => canSeeNavItem(item, group)));
    if (!visible.some(item => item.slug === active)) {
      const fallback = visible[0]?.slug || 'dashboard';
      setActive(fallback);
      setExpanded([visible[0]?.group || 'TỔNG QUAN']);
      window.history.replaceState({ slug: fallback }, '', `/${fallback}`);
    }
  }, [profileRoleCode]);
  const select = (item, group) => { setActive(item.slug); setExpanded([group.title]); setMobileOpen(false); if (window.location.pathname !== `/${item.slug}`) window.history.pushState({ slug: item.slug }, '', `/${item.slug}`); };
  React.useEffect(() => {
    const syncPath = () => { const slug = resolvePath(window.location.pathname); setActive(slug); const item = allItems.find(x => x.slug === slug); if (item) setExpanded([item.group]); };
    window.addEventListener('popstate', syncPath);
    const expected = `/${resolvePath(window.location.pathname)}`;
    if (window.location.pathname !== expected) window.history.replaceState({ slug: resolvePath(window.location.pathname) }, '', expected);
    syncPath();
    return () => window.removeEventListener('popstate', syncPath);
  }, []);
  if (!authReady) return <div className="auth-loading"><div className="auth-spinner"/><span>Đang kiểm tra phiên đăng nhập…</span></div>;
  if (!isSupabaseConfigured || !session) return <Login onLogin={setSession} />;
  return <div className="app-shell">
    {mobileOpen && <button className="mobile-scrim" aria-label="Đóng menu" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-block"><div className="brand-mark"><img src="/logo-viet-au.png" alt="Logo Việt Âu" /></div><div className="brand-copy"><strong>VIỆT ÂU</strong><span>PAYROLL SYSTEM</span></div><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Đóng"><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">VA</div><div className="workspace-label"><strong>Quản trị tiền lương</strong><span>Không gian nội bộ</span></div><ChevronDown size={15}/></div>
      <div className="nav-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm chức năng..."/><kbd>⌘ K</kbd></div>
      <nav className="navigation">{filtered.map(group => <div className="nav-group" key={group.title}>{group.title === 'TỔNG QUAN' ? <button className={`nav-group-title nav-group-title-direct ${active === 'dashboard' ? 'active' : ''}`} onClick={() => select(group.items[0], group)}><span>{group.title}</span><ChevronRight size={14}/></button> : <><button className="nav-group-title" onClick={() => setExpanded(old => old.includes(group.title) ? old.filter(x => x !== group.title) : [...old, group.title])}><span>{group.title}</span><ChevronDown size={14} className={expanded.includes(group.title) || query ? 'chevron expanded' : 'chevron'}/></button>{(expanded.includes(group.title) || query) && <div className="nav-items">{group.items.map(item => <button key={item.slug} className={`nav-item ${active === item.slug ? 'active' : ''}`} onClick={() => select(item, group)}><span className="nav-item-dot"/><span>{item.label}</span>{active === item.slug && <ChevronRight size={15}/>}</button>)}</div>}</>}</div>)}</nav>
      <div className="sidebar-bottom"><div className="build-status"><span className="status-dot"/><div><strong>Bộ khung sạch</strong><span>Chưa kết nối dữ liệu</span></div></div><div className="sidebar-version">VIỆT ÂU PAYROLL <span>·</span> V9 CLEAN BASE</div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><MenuIcon size={20}/></button><div className="breadcrumbs"><span>VIỆT ÂU</span><ChevronRight size={14}/><span>{current.group}</span><ChevronRight size={14}/><strong>{current.label}</strong></div></div><div className="topbar-actions"><div className="environment-chip"><span/>MÔI TRƯỜNG MỚI</div><button className="icon-button notification-button" aria-label="Thông báo"><Bell size={18}/><i/></button><div className="profile-wrap"><button className="user-chip profile-trigger" onClick={()=>setProfileOpen(v=>!v)} aria-expanded={profileOpen}><div className="user-avatar">{(profileName || session.user.email || 'U').trim().slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{profileName || session.user.email || 'Tài khoản'}</strong><span>{session.user.email}</span></div><ChevronDown size={15}/></button>{profileOpen&&<><button className="profile-dismiss" aria-label="Đóng hồ sơ" onClick={()=>setProfileOpen(false)}/><div className="profile-menu"><div className="profile-menu-head"><b>{profileName || 'Tài khoản Việt Âu'}</b><span>{session.user.email}</span>{profileRole&&<small>{profileRole}</small>}</div><button onClick={()=>{setProfileOpen(false);setPasswordModal(true);setPasswordError('');}}><KeyRound size={15}/> Đổi mật khẩu</button><button className="profile-logout" onClick={async()=>{await supabase.auth.signOut();setSession(null);}}><LogOut size={15}/> Đăng xuất</button></div></>}</div></div></header>
      <div className="page-content"><div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13}/> WORKSPACE · PAYROLL</div><h1>{current.label}</h1><p>Hệ thống quản trị tiền lương Trường THPT Việt Âu</p></div>{active !== 'dashboard' && <div className="date-chip"><span>GIAI ĐOẠN</span><strong>Khởi tạo hệ thống</strong></div>}</div>{active !== 'dashboard' && <div className="notice-banner"><div className="notice-icon"><Command size={17}/></div><div><strong>Đang xây dựng nền tảng mới</strong><p>Chưa có dữ liệu import. Mỗi tính năng sẽ được triển khai độc lập theo từng giai đoạn.</p></div><span className="notice-tag">CLEAN BASE</span></div>}<Page key={active}/><footer className="page-footer"><span>VIỆT ÂU PAYROLL</span><span>Thiết kế theo hướng module độc lập · V9</span></footer></div>
    </main>
    {passwordModal && <div className="profile-modal-backdrop"><form className="profile-modal" onSubmit={savePassword}><div className="profile-modal-icon"><KeyRound size={22}/></div><h2>{mustChangePassword ? 'Đổi mật khẩu lần đầu' : 'Đổi mật khẩu'}</h2><p>{mustChangePassword ? 'Bạn cần tạo mật khẩu cá nhân trước khi tiếp tục sử dụng hệ thống.' : 'Nhập mật khẩu hiện tại và mật khẩu mới của bạn.'}</p>{!mustChangePassword&&<label>Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={oldPassword} onChange={e=>setOldPassword(e.target.value)} required/></label>}<label>Mật khẩu mới<div className="profile-password-input"><input type={showNewPassword?'text':'password'} autoComplete="new-password" minLength={10} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/><button type="button" onClick={()=>setShowNewPassword(v=>!v)}>{showNewPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><label>Xác nhận mật khẩu mới<input type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/></label>{passwordError&&<div className="profile-password-error">{passwordError}</div>}<button className="profile-save-password" disabled={passwordBusy}>{passwordBusy?'Đang cập nhật…':<><Check size={16}/> Lưu mật khẩu</>}</button>{!mustChangePassword&&<button type="button" className="profile-cancel-password" onClick={()=>setPasswordModal(false)}>Hủy</button>}</form></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
