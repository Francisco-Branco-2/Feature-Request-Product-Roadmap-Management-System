import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { LangToggle } from './StatusPill';

function UserChip() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="row">
      <span style={{ fontSize: 13, color: 'var(--texto-secundario)' }}>
        {user.name}
        {user.organization ? ` · ${user.organization}` : ''}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={async () => {
          await signOut();
          navigate('/login');
        }}
      >
        {t('logout')}
      </button>
    </div>
  );
}

export function CustomerLayout() {
  const { t } = useI18n();
  return (
    <div className="customer-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <div className="portal">{t('customerPortal')}</div>
        <nav className="topbar-tabs">
          <NavLink to="/customer/requests">{t('myRequests')}</NavLink>
          <NavLink to="/customer/search">{t('searchRequests')}</NavLink>
        </nav>
        <div className="topbar-right">
          <NavLink to="/customer/new" className="btn btn-primary">
            {t('newRequest')}
          </NavLink>
          <LangToggle />
          <UserChip />
        </div>
      </header>
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
}

function TeamSidebar({ links }) {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" />
        {t('appName')}
      </div>
      <nav>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-foot">
        <div>{user?.name}</div>
        <div>{user?.title}</div>
      </div>
    </aside>
  );
}

export function PoLayout() {
  const { t, lang } = useI18n();
  const items = [
    { to: '/po/requests', label: lang === 'pt' ? 'Pedidos' : 'Requests' },
    { to: '/po/backlog', label: t('backlog') },
    { to: '/po/roadmap', label: t('roadmap') },
    { to: '/po/metrics', label: t('metrics') },
    { to: '/po/merge', label: t('compareMerge') },
    { to: '/po/notifications', label: t('notifications') },
  ];
  return (
    <div className="app-shell">
      <TeamSidebar links={items} />
      <div className="main-col">
        <header className="topbar">
          <div className="portal">{t('teamPortal')}</div>
          <div className="topbar-right">
            <LangToggle />
            <UserChip />
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function DevLayout() {
  const { t } = useI18n();
  const items = [
    { to: '/dev/workspace', label: t('teamSpace') },
    { to: '/dev/features', label: t('features') },
    { to: '/dev/backlog', label: t('backlog') },
    { to: '/dev/notifications', label: t('notifications') },
  ];
  return (
    <div className="app-shell">
      <TeamSidebar links={items} />
      <div className="main-col">
        <header className="topbar">
          <div className="portal">{t('teamPortal')}</div>
          <div className="topbar-right">
            <LangToggle />
            <UserChip />
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function PmLayout() {
  const { t } = useI18n();
  const items = [
    { to: '/pm/releases', label: t('releases') },
    { to: '/pm/roadmap', label: t('roadmap') },
    { to: '/pm/metrics', label: t('metrics') },
    { to: '/pm/workspace', label: t('teamSpace') },
    { to: '/pm/notifications', label: t('notifications') },
  ];
  return (
    <div className="app-shell">
      <TeamSidebar links={items} />
      <div className="main-col">
        <header className="topbar">
          <div className="portal">{t('teamPortal')}</div>
          <div className="topbar-right">
            <LangToggle />
            <UserChip />
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
