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
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur shadow-lg">
      <div className="flex justify-around items-center py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => {
          const isActive = pathname === to;

          return (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span>{t(labelKey)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
