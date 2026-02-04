import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import HoursCalendar from '../components/HoursCalendar';
import MonthlyHoursCalculator from '../components/MonthlyHoursCalculator';
import TeamScheduleCalendar from '../components/TeamScheduleCalendar';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

const Schedule = () => {
  const auth = useAuth(); const user = auth?.user;
  const [activeTab, setActiveTab] = useState('calendar');
  const [initializingSchedule, setInitializingSchedule] = useState(false);
  const tabsScrollRef = useRef(null);
  const [showTabsHint, setShowTabsHint] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [focusDate, setFocusDate] = useState(null);

  useEffect(() => {
    const container = tabsScrollRef.current;
    if (!container) return;

    const updateHint = () => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      const hasOverflow = maxScroll > 6;
      const showHint = hasOverflow && container.scrollLeft < maxScroll - 6;
      setShowTabsHint(showHint);
    };

    updateHint();

    const handleScroll = () => updateHint();
    const handleResize = () => updateHint();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const initializeDefaultSchedule = async () => {
      if (!user || user.first_login_completed !== false || initializingSchedule) {
        return;
      }

      setInitializingSchedule(true);
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `${process.env.REACT_APP_API_URL}/api/schedule/initialize-default`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Reload user data to update first_login_completed flag
        if (auth?.refetchUser) {
          await auth.refetchUser();
        }
      } catch (error) {
        console.error('Error initializing default schedule:', error);
      } finally {
        setInitializingSchedule(false);
      }
    };

    initializeDefaultSchedule();
  }, [user, initializingSchedule, auth]);

  useEffect(() => {
    let nextFocus = null;
    if (location?.state?.focusDate) {
      const parsed = new Date(location.state.focusDate);
      if (!Number.isNaN(parsed.getTime())) {
        nextFocus = parsed;
      }
    } else if (location?.hash === '#today') {
      nextFocus = new Date();
    }

    if (nextFocus) {
      setFocusDate(nextFocus);
      setActiveTab('calendar');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  return (
    <div className="schedule-page min-h-screen bg-slate-50 pt-4 pb-20 px-3 sm:px-6">
      <div className="schedule-page__container w-full mx-auto space-y-8">
        {/* Page Header */}
        <div className="schedule-header space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Arbeitsstunden Planung
          </h1>
          <p className="text-gray-600">
            Verwalten Sie Ihren Wochenplan und verfolgen Sie Ihr monatliches Stundenkonto
          </p>
          <div className="schedule-user-card mt-4 bg-white rounded-lg shadow-sm p-4 inline-block">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <span className="text-sm text-gray-700">
                  {user?.name || 'User'}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                <span className="text-sm text-gray-700">
                  {user?.employment_type || 'Werkstudent'}
                </span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                <span className="text-sm font-semibold text-gray-900">
                  {user?.weekly_hours_quota || 20}h/week
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="schedule-tabs">
          <div className="border-b border-gray-200 relative">
            <div className="schedule-tabs__scroll" ref={tabsScrollRef}>
              <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('calendar')}
                className={`${
                  activeTab === 'calendar'
                    ? 'schedule-tab--active border-blue-600 text-blue-600'
                    : 'schedule-tab--inactive border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } schedule-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Wochenkalender
                </div>
              </button>
              <button
                onClick={() => setActiveTab('monthly')}
                className={`${
                  activeTab === 'monthly'
                    ? 'schedule-tab--active border-amber-600 text-amber-600'
                    : 'schedule-tab--inactive border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } schedule-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Monatsrechner
                </div>
              </button>
              <button
                onClick={() => setActiveTab('team')}
                className={`${
                  activeTab === 'team'
                    ? 'schedule-tab--active border-green-600 text-green-600'
                    : 'schedule-tab--inactive border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } schedule-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Team-Übersicht
                </div>
              </button>
              </nav>
            </div>
            {showTabsHint && (
              <>
                <div className="schedule-tabs__fade" aria-hidden="true" />
                <div className="schedule-tabs__hint" aria-hidden="true">
                  <span>Wischen</span>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 5l6 5-6 5" />
                  </svg>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="schedule-content space-y-8">
          {activeTab === 'calendar' && <HoursCalendar focusDate={focusDate} />}
          {activeTab === 'monthly' && <MonthlyHoursCalculator />}
          {activeTab === 'team' && <TeamScheduleCalendar />}
        </div>

        {/* Help Section */}
        <div className="schedule-help mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            So funktioniert es
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Wochenkalender</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Markieren Sie die Tage, an denen Sie arbeiten</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Legen Sie Start- und Endzeiten für jeden Tag fest</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Sehen Sie die Stundenberechnung in Echtzeit</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Verfolgen Sie, ob Sie unter- oder überplant sind</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Monatsrechner</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Sehen Sie das monatliche Stundenkonto</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Sehen Sie die wöchentliche Aufschlüsselung</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Verfolgen Sie die Einhaltung Ihres Vertrags</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Vermeiden Sie Überplanung und Burnout</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
