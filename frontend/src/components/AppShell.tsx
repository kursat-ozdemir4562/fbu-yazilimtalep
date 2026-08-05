import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  FlaskConical,
  Gauge,
  History,
  LayoutDashboard,
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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ROLE_LABELS } from '../lib/constants';
import { classNames, formatClock, initials } from '../lib/utils';
import { APP_VERSION } from '../lib/version';
import { ROLES, type UserRole } from '../types';

interface MenuLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface MenuGroup {
  label: string;
  icon: LucideIcon;
  children: MenuLink[];
}

type MenuEntry = MenuLink | MenuGroup;

function isMenuGroup(entry: MenuEntry): entry is MenuGroup {
  return 'children' in entry;
}

const academicMenu: MenuEntry[] = [
  { to: '/', label: 'Gösterge Paneli', icon: LayoutDashboard },
  { to: '/talepler', label: 'Taleplerim', icon: ClipboardList },
  { to: '/talep/yeni', label: 'Yeni Talep', icon: PlusCircle },
  { to: '/raporlar', label: 'Raporlarım', icon: FileBarChart },
  { to: '/bildirimler', label: 'Bildirimler', icon: Bell },
];

const facultyMenu: MenuEntry[] = [
  { to: '/', label: 'Fakülte Özeti', icon: Gauge },
  { to: '/talepler', label: 'Fakülte Talepleri', icon: ClipboardList },
  { to: '/raporlar', label: 'Fakülte Raporları', icon: FileBarChart },
  { to: '/bildirimler', label: 'Bildirimler', icon: Bell },
];

const adminMenu: MenuEntry[] = [
  { to: '/', label: 'Genel Gösterge', icon: LayoutDashboard },
  { to: '/talepler', label: 'Bütün Talepler', icon: ClipboardList },
  { to: '/programlar', label: 'Program Yönetimi', icon: BookOpenCheck },
  { to: '/fakulteler', label: 'Fakülte Yönetimi', icon: Building2 },
  { to: '/laboratuvarlar', label: 'Laboratuvarlar', icon: FlaskConical },
  { to: '/yetkiler', label: 'Rol ve Yetkiler', icon: ShieldCheck },
  { to: '/donemler', label: 'Akademik Dönemler', icon: UserCog },
  { to: '/ders-programi', label: 'Ders Programı', icon: CalendarDays },
  { to: '/raporlar', label: 'Raporlar', icon: FileBarChart },
  { to: '/bildirimler', label: 'Bildirimler', icon: Bell },
  {
    label: 'Sistem Ayarları',
    icon: Settings,
    children: [
      { to: '/ayarlar', label: 'Genel Ayarlar', icon: Settings },
      { to: '/kullanicilar', label: 'Kullanıcı Yönetimi', icon: Users },
      { to: '/audit', label: 'Audit Log', icon: History },
    ],
  },
];

export function menuForRoles(roles: UserRole[]): MenuEntry[] {
  if (roles.includes(ROLES.administrator)) return adminMenu;
  if (roles.includes(ROLES.faculty)) return facultyMenu;
  return academicMenu;
}

function isChildRouteActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
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
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  return (
    <nav className="sidebar__nav" aria-label="Ana menü">
      {menuForRoles(roles).map((entry) => {
        if (isMenuGroup(entry)) {
          const isChildActive = entry.children.some((child) =>
            isChildRouteActive(pathname, child.to),
          );
          const isOpen = collapsed || (openGroups[entry.label] ?? isChildActive);
          const GroupIcon = entry.icon;
          return (
            <div className="sidebar-group" key={entry.label}>
              {!collapsed && (
                <button
                  type="button"
                  className={classNames(
                    'sidebar-link',
                    'sidebar-group__toggle',
                    isChildActive && 'is-active',
                  )}
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [entry.label]: !(prev[entry.label] ?? isChildActive),
                    }))
                  }
                >
                  <GroupIcon aria-hidden="true" />
                  <span>{entry.label}</span>
                  <ChevronDown
                    className={classNames('sidebar-group__chevron', isOpen && 'is-open')}
                    aria-hidden="true"
                  />
                </button>
              )}
              {isOpen && (
                <div className="sidebar-group__children">
                  {entry.children.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      to={to}
                      key={to}
                      className={(isActive) =>
                        classNames('sidebar-link', 'sidebar-link--sub', isActive && 'is-active')
                      }
                      title={collapsed ? label : undefined}
                      onClick={onNavigate}
                    >
                      <Icon aria-hidden="true" />
                      {!collapsed && <span>{label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        }
        const { to, label, icon: Icon } = entry;
        return (
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
        );
      })}
    </nav>
  );
}

function TopbarClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="topbar__clock">
      <span className="version-badge">{APP_VERSION}</span>
      <span className="topbar__clock-time">{formatClock(now)}</span>
    </div>
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

        <div className="sidebar__footer">
          <div className="sidebar__profile">
            <span className="avatar">{initials(user.fullName)}</span>
            {!collapsed && (
              <div className="sidebar__profile-copy">
                <strong>{user.fullName}</strong>
                <small>{ROLE_LABELS[primaryRole]}</small>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="sidebar__profile-actions">
              <Link to="/profilim" className="sidebar__profile-action">
                <UserRound aria-hidden="true" /> Profil
              </Link>
              <button
                type="button"
                className="sidebar__profile-action sidebar__profile-action--danger"
                onClick={() => void logout()}
              >
                <LogOut aria-hidden="true" /> Çıkış
              </button>
            </div>
          )}
          {!collapsed && <small className="sidebar__version">{APP_VERSION}</small>}
        </div>
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
            <TopbarClock />
            <Link
              className="icon-button notification-button"
              to="/bildirimler"
              aria-label="Bildirimler"
            >
              <Bell aria-hidden="true" />
              <span className="notification-dot" />
            </Link>
            <button
              className={classNames('theme-toggle', isDark && 'is-dark')}
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
              title={isDark ? 'Açık tema' : 'Koyu tema'}
            >
              <Sun className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true" />
              <Moon className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true" />
              <span className="theme-toggle__thumb" aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className="content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
