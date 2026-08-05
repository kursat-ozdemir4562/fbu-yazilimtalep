import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  FlaskConical,
  Gauge,
  History,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ROLE_LABELS } from '../lib/constants';
import { classNames, initials } from '../lib/utils';
import { ROLES, type UserRole } from '../types';

interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const academicMenu: MenuItem[] = [
  { to: '/', label: 'Gösterge Paneli', icon: LayoutDashboard },
  { to: '/talepler', label: 'Taleplerim', icon: ClipboardList },
  { to: '/talep/yeni', label: 'Yeni Talep', icon: PlusCircle },
  { to: '/oneriler', label: 'Program Önerilerim', icon: Lightbulb },
  { to: '/raporlar', label: 'Raporlarım', icon: FileBarChart },
  { to: '/bildirimler', label: 'Bildirimler', icon: Bell },
];

const facultyMenu: MenuItem[] = [
  { to: '/', label: 'Fakülte Özeti', icon: Gauge },
  { to: '/talepler', label: 'Fakülte Talepleri', icon: ClipboardList },
  { to: '/oneriler', label: 'Program Önerileri', icon: Lightbulb },
  { to: '/raporlar', label: 'Fakülte Raporları', icon: FileBarChart },
  { to: '/bildirimler', label: 'Bildirimler', icon: Bell },
];

const adminMenu: MenuItem[] = [
  { to: '/', label: 'Genel Gösterge', icon: LayoutDashboard },
  { to: '/talepler', label: 'Bütün Talepler', icon: ClipboardList },
  { to: '/programlar', label: 'Program Yönetimi', icon: BookOpenCheck },
  { to: '/oneriler', label: 'Program Önerileri', icon: Lightbulb },
  { to: '/fakulteler', label: 'Fakülte Yönetimi', icon: Building2 },
  { to: '/laboratuvarlar', label: 'Laboratuvarlar', icon: FlaskConical },
  { to: '/kullanicilar', label: 'Kullanıcı Yönetimi', icon: Users },
  { to: '/yetkiler', label: 'Rol ve Yetkiler', icon: ShieldCheck },
  { to: '/donemler', label: 'Akademik Dönemler', icon: UserCog },
  { to: '/ders-programi', label: 'Ders Programı', icon: CalendarDays },
  { to: '/raporlar', label: 'Raporlar', icon: FileBarChart },
  { to: '/bildirimler', label: 'Bildirimler', icon: Bell },
  { to: '/audit', label: 'Audit Log', icon: History },
  { to: '/ayarlar', label: 'Sistem Ayarları', icon: Settings },
];

export function menuForRoles(roles: UserRole[]): MenuItem[] {
  if (roles.includes(ROLES.administrator)) return adminMenu;
  if (roles.includes(ROLES.faculty)) return facultyMenu;
  return academicMenu;
}

export function RoleMenu({
  roles,
  collapsed = false,
  onNavigate,
}: {
  roles: UserRole[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="sidebar__nav" aria-label="Ana menü">
      {menuForRoles(roles).map(({ to, label, icon: Icon }) => (
        <NavLink
          to={to}
          key={to}
          exact={to === '/'}
          className={(isActive) => classNames('sidebar-link', isActive && 'is-active')}
          title={collapsed ? label : undefined}
          onClick={onNavigate}
        >
          <Icon aria-hidden="true" />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const primaryRole = useMemo(() => {
    if (user?.roles.includes(ROLES.administrator)) return ROLES.administrator;
    if (user?.roles.includes(ROLES.faculty)) return ROLES.faculty;
    if (user?.roles.includes(ROLES.administrative)) return ROLES.administrative;
    return ROLES.academic;
  }, [user?.roles]);

  if (!user) return null;
  return (
    <div className={classNames('app-shell', collapsed && 'app-shell--collapsed')}>
      {mobileOpen && (
        <button
          className="mobile-overlay"
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={classNames('sidebar', mobileOpen && 'is-open')}>
        <div className="sidebar__brand">
          <Link to="/" aria-label="FBU ana sayfa">
            <img className="brand-mark" src="/fbu-logo.png" alt="Fenerbahçe Üniversitesi" />
            {!collapsed && (
              <span className="brand-copy">
                <strong>Lab Yazılım</strong>
                <small>Talep Sistemi</small>
              </span>
            )}
          </Link>
          <button
            className="icon-button mobile-only"
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setMobileOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {!collapsed && (
          <div className="sidebar__context">
            <span className="context-dot" />
            <div>
              <small>Aktif dönem</small>
              <strong>2026–2027 Güz</strong>
            </div>
          </div>
        )}
        <RoleMenu
          roles={user.roles}
          collapsed={collapsed}
          onNavigate={() => setMobileOpen(false)}
        />
        <button
          className="sidebar__collapse desktop-only"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
        >
          {collapsed ? <ChevronRight aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          {!collapsed && <span>Menüyü daralt</span>}
        </button>
      </aside>

      <div className="app-shell__main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              className="icon-button mobile-only"
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Menüyü aç"
            >
              <Menu aria-hidden="true" />
            </button>
            <div>
              <span className="topbar__institution">Fenerbahçe Üniversitesi</span>
              <small>{user.facultyName ?? 'Bilgi Teknolojileri Direktörlüğü'}</small>
            </div>
          </div>
          <div className="topbar__actions">
            <button
              className="icon-button"
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
              title={isDark ? 'Açık tema' : 'Koyu tema'}
            >
              {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <Link
              className="icon-button notification-button"
              to="/bildirimler"
              aria-label="Bildirimler"
            >
              <Bell aria-hidden="true" />
              <span className="notification-dot" />
            </Link>
            <div className="user-menu">
              <span className="avatar">{initials(user.fullName)}</span>
              <div className="user-menu__copy">
                <strong>{user.fullName}</strong>
                <small>{ROLE_LABELS[primaryRole]}</small>
              </div>
              <ChevronLeft className="user-menu__chevron" aria-hidden="true" />
              <div className="user-menu__dropdown">
                <div>
                  <strong>{user.email}</strong>
                  <small>{user.facultyName ?? 'FBU'}</small>
                </div>
                <Link to="/profilim">
                  <UserRound aria-hidden="true" /> Profilim
                </Link>
                <button type="button" onClick={() => void logout()}>
                  <LogOut aria-hidden="true" /> Güvenli çıkış
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
