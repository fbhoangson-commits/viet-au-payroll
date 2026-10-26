import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Bell, ChevronDown, ChevronRight, Menu as MenuIcon, X, Command, Sparkles } from 'lucide-react';
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
  const current = allItems.find(item => item.slug === active) || allItems[0];
  const Page = pages[`./features/${active}/Page.jsx`] || pages['./features/dashboard/Page.jsx'];
  const filtered = useMemo(() => NAV_GROUPS.map(group => ({...group, items: group.items.filter(item => `${item.label} ${group.title}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))})).filter(group => group.items.length), [query]);
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
      <nav className="navigation">{filtered.map(group => <div className="nav-group" key={group.title}><button className="nav-group-title" onClick={() => setExpanded(old => old.includes(group.title) ? old.filter(x => x !== group.title) : [...old, group.title])}><span>{group.title}</span><ChevronDown size={14} className={expanded.includes(group.title) || query ? 'chevron expanded' : 'chevron'}/></button>{(expanded.includes(group.title) || query) && <div className="nav-items">{group.items.map(item => <button key={item.slug} className={`nav-item ${active === item.slug ? 'active' : ''}`} onClick={() => select(item, group)}><span className="nav-item-dot"/><span>{item.label}</span>{active === item.slug && <ChevronRight size={15}/>}</button>)}</div>}</div>)}</nav>
      <div className="sidebar-bottom"><div className="build-status"><span className="status-dot"/><div><strong>Bộ khung sạch</strong><span>Chưa kết nối dữ liệu</span></div></div><div className="sidebar-version">VIỆT ÂU PAYROLL <span>·</span> V9 CLEAN BASE</div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><MenuIcon size={20}/></button><div className="breadcrumbs"><span>VIỆT ÂU</span><ChevronRight size={14}/><span>{current.group}</span><ChevronRight size={14}/><strong>{current.label}</strong></div></div><div className="topbar-actions"><div className="environment-chip"><span/>MÔI TRƯỜNG MỚI</div><button className="icon-button notification-button" aria-label="Thông báo"><Bell size={18}/><i/></button><div className="user-chip"><div className="user-avatar">{(session.user.email || 'U').slice(0,1).toUpperCase()}</div><div><strong>{session.user.email || 'Tài khoản'}</strong><span>Đã xác thực</span></div><button className="signout-button" onClick={async()=>{await supabase.auth.signOut();setSession(null);}} title="Đăng xuất">Đăng xuất</button></div></div></header>
      <div className="page-content"><div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13}/> WORKSPACE · PAYROLL</div><h1>{current.label}</h1><p>Hệ thống quản trị tiền lương Trường THPT Việt Âu</p></div><div className="date-chip"><span>GIAI ĐOẠN</span><strong>Khởi tạo hệ thống</strong></div></div><div className="notice-banner"><div className="notice-icon"><Command size={17}/></div><div><strong>Đang xây dựng nền tảng mới</strong><p>Chưa có dữ liệu import. Mỗi tính năng sẽ được triển khai độc lập theo từng giai đoạn.</p></div><span className="notice-tag">CLEAN BASE</span></div><Page key={active}/><footer className="page-footer"><span>VIỆT ÂU PAYROLL</span><span>Thiết kế theo hướng module độc lập · V9</span></footer></div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
