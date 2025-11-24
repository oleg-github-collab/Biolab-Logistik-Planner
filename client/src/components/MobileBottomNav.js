import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, ClipboardCheck, User, Boxes, BookOpen } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import { getUnreadMessagesCount } from '../utils/apiEnhanced';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'navigation.dashboard' },
  { to: '/kanban', icon: ClipboardCheck, labelKey: 'navigation.tasks' },
  { to: '/messages', icon: MessageSquare, labelKey: 'navigation.messages' },
  { to: '/schedule', icon: Calendar, labelKey: 'navigation.schedule' },
  { to: '/kisten', icon: Boxes, labelKey: 'navigation.kisten' },
  { to: '/knowledge-base', icon: BookOpen, labelKey: 'navigation.knowledge' },
  { to: '/profile/me', icon: User, labelKey: 'mobile.quickActions.profile' }
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { t } = useLocale();
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await getUnreadMessagesCount();
        setUnreadMessagesCount(response.data?.count || 0);
      } catch (error) {
        console.error('Failed to fetch unread messages count:', error);
      }
    };

    fetchUnreadCount();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  if (['/login', '/first-setup'].includes(pathname)) {
    return null;
  }

  const getBadgeCount = (path) => {
    if (path === '/messages') return unreadMessagesCount;
    return 0;
  };

  return (
    <nav className="bottom-nav-mobile lg:hidden">
      {NAV_ITEMS.map(({ to, icon: Icon, labelKey }) => {
        const isActive = pathname === to;
        const badgeCount = getBadgeCount(to);

        return (
          <NavLink
            key={to}
            to={to}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="relative">
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              {badgeCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </div>
            <span className="font-medium">{t(labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
