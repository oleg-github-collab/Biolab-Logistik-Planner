import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, ClipboardCheck, User } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'navigation.dashboard' },
  { to: '/task-pool', icon: ClipboardCheck, labelKey: 'navigation.tasks' },
  { to: '/messages', icon: MessageSquare, labelKey: 'navigation.messages' },
  { to: '/schedule', icon: Calendar, labelKey: 'navigation.schedule' },
  { to: '/profile/me', icon: User, labelKey: 'mobile.quickActions.profile' }
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { t } = useLocale();

  if (['/login', '/first-setup'].includes(pathname)) {
    return null;
  }

  return (
    <nav className="bottom-nav-mobile lg:hidden">
      {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => {
        const isActive = pathname === to;

        return (
          <NavLink
            key={to}
            to={to}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
            <span className="font-medium">{t(labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
