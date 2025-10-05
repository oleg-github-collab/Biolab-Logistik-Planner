import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isToday, getWeek, subMonths, addMonths, parseISO, isSameMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import EventModal from './EventModal';
import EventDetailsModal from './EventDetailsModal';
import QuickActionsModal from './QuickActionsModal';

// Waste type templates imported as constants for performance
const WASTE_TEMPLATES = {
  "aceton": { name: "Aceton", color: "#FF6B6B", icon: "⚗️", hazard_level: "high", category: "chemical" },
  "chloroform": { name: "Chloroform", color: "#C92A2A", icon: "☠️", hazard_level: "critical", category: "chemical" },
  "methanol": { name: "Methanol", color: "#FA5252", icon: "⚠️", hazard_level: "high", category: "chemical" },
  "ethanol": { name: "Ethanol", color: "#FFA94D", icon: "🍷", hazard_level: "medium", category: "chemical" },
  "formaldehyd": { name: "Formaldehyd", color: "#E03131", icon: "☢️", hazard_level: "critical", category: "chemical" },
  "saeuren": { name: "Säuren", color: "#E64980", icon: "🧪", hazard_level: "high", category: "chemical" },
  "laugen": { name: "Laugen", color: "#BE4BDB", icon: "🔬", hazard_level: "high", category: "chemical" },
  "loesungsmittel_gemische": { name: "Lösungsmittel-Gemische", color: "#FF8787", icon: "🧴", hazard_level: "high", category: "chemical" },
  "schwermetalle": { name: "Schwermetalle", color: "#495057", icon: "⚫", hazard_level: "critical", category: "heavy_metal" },
  "quecksilber": { name: "Quecksilber", color: "#868E96", icon: "💧", hazard_level: "critical", category: "heavy_metal" },
  "waessrige_loesungen": { name: "Wässrige Lösungen", color: "#4DABF7", icon: "💦", hazard_level: "medium", category: "aqueous" },
  "asbest": { name: "Asbest", color: "#212529", icon: "⚠️", hazard_level: "critical", category: "hazardous" },
  "infektioese_abfaelle": { name: "Infektiöse Abfälle", color: "#C92A2A", icon: "🦠", hazard_level: "critical", category: "biological" },
  "scharfe_gegenstaende": { name: "Scharfe Gegenstände", color: "#868E96", icon: "🔪", hazard_level: "high", category: "hazardous" },
  "bauschutt": { name: "Bauschutt", color: "#A0826D", icon: "🧱", hazard_level: "low", category: "construction" },
  "kontaminierter_boden": { name: "Kontaminierter Boden", color: "#8B4513", icon: "🌍", hazard_level: "high", category: "soil" },
  "leere_behaelter": { name: "Leere Behälter", color: "#ADB5BD", icon: "📦", hazard_level: "low", category: "container" },
  "spraydosen": { name: "Spraydosen", color: "#74C0FC", icon: "💨", hazard_level: "medium", category: "container" },
  "biologische_abfaelle": { name: "Biologische Abfälle", color: "#51CF66", icon: "🧬", hazard_level: "high", category: "biological" },
  "zellkultur": { name: "Zellkultur", color: "#69DB7C", icon: "🔬", hazard_level: "high", category: "biological" },
  "glas": { name: "Glas", color: "#228BE6", icon: "🔷", hazard_level: "low", category: "general" },
  "plastik": { name: "Plastik", color: "#FCC419", icon: "♻️", hazard_level: "low", category: "general" },
  "papier": { name: "Papier", color: "#94D82D", icon: "📄", hazard_level: "low", category: "general" }
};

const HAZARD_LEVEL_CONFIG = {
  critical: { badge: 'Kritisch', color: '#C92A2A', bgColor: '#FFF5F5', borderColor: '#C92A2A' },
  high: { badge: 'Hoch', color: '#E64980', bgColor: '#FFF0F6', borderColor: '#E64980' },
  medium: { badge: 'Mittel', color: '#FFA94D', bgColor: '#FFF4E6', borderColor: '#FFA94D' },
  low: { badge: 'Niedrig', color: '#51CF66', bgColor: '#F4FCE3', borderColor: '#51CF66' }
};

const CalendarView = ({
  events = [],
  onDateSelect,
  onEventClick,
  selectedDate,
  viewType = 'month',
  onEventCreate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [showQuickActionsModal, setShowQuickActionsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [quickActionDate, setQuickActionDate] = useState(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '17:00',
    type: 'Arbeit',
    isRecurring: false,
    recurrencePattern: 'weekly'
  });
  const [hoveredDate, setHoveredDate] = useState(null);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [showMiniCalendar, setShowMiniCalendar] = useState(false);
  const [screenSize, setScreenSize] = useState('desktop');
  const [filterWasteType, setFilterWasteType] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  // Responsive screen detection
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) setScreenSize('mobile');
      else if (width < 1024) setScreenSize('tablet');
      else setScreenSize('desktop');
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  // Helper function to get waste type styling
  const getWasteTypeStyle = useCallback((wasteType) => {
    const template = WASTE_TEMPLATES[wasteType];
    if (!template) return null;

    const hazardConfig = HAZARD_LEVEL_CONFIG[template.hazard_level] || HAZARD_LEVEL_CONFIG.low;
    return {
      ...template,
      hazardConfig
    };
  }, []);

  // Helper to check if event is waste-related
  const isWasteEvent = useCallback((event) => {
    return event.type === 'waste' || event.waste_type || event.wasteType;
  }, []);

  // Memoized filtered events for performance
  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (filterWasteType) {
      filtered = filtered.filter(event =>
        isWasteEvent(event) && (event.waste_type === filterWasteType || event.wasteType === filterWasteType)
      );
    }

    if (filterCategory) {
      filtered = filtered.filter(event => {
        if (!isWasteEvent(event)) return false;
        const wasteType = event.waste_type || event.wasteType;
        const template = WASTE_TEMPLATES[wasteType];
        return template && template.category === filterCategory;
      });
    }

    return filtered;
  }, [events, filterWasteType, filterCategory, isWasteEvent]);

  // Get unique waste categories for filter
  const wasteCategories = useMemo(() => {
    const categories = new Set();
    Object.values(WASTE_TEMPLATES).forEach(template => {
      categories.add(template.category);
    });
    return Array.from(categories);
  }, []);

  // Swipe navigation for mobile
  const handleTouchStart = useCallback((e) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStart) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) {
        // Swipe left - next
        setCurrentDate(addDays(currentDate, screenSize === 'mobile' ? 1 : 7));
      } else {
        // Swipe right - previous
        setCurrentDate(addDays(currentDate, screenSize === 'mobile' ? -1 : -7));
      }
    }

    setTouchStart(null);
  }, [touchStart, currentDate, screenSize]);

  const renderHeader = () => {
    const dateFormat = viewType === 'month' ? 'MMMM yyyy' : 'yyyy';

    return (
      <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-blue-50 via-white to-purple-50 rounded-t-lg shadow-sm border-b border-blue-100">
        <button
          onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          className="p-2 md:p-2.5 hover:bg-white hover:shadow-md rounded-full transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Vorheriger Monat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`${screenSize === 'mobile' ? 'h-4 w-4' : 'h-5 w-5'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date())}
            className={`${screenSize === 'mobile' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all hover:shadow-md font-medium`}
          >
            Heute
          </button>
          <h2 className={`${screenSize === 'mobile' ? 'text-sm' : 'text-lg'} font-bold text-gray-800 capitalize`}>
            {format(currentDate, dateFormat, { locale: de })}
          </h2>
        </div>

        <button
          onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          className="p-2 md:p-2.5 hover:bg-white hover:shadow-md rounded-full transition-all active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Nächster Monat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`${screenSize === 'mobile' ? 'h-4 w-4' : 'h-5 w-5'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;

        // Get events for this day - use filtered events
        const dayEvents = filteredEvents.filter(event => {
          const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
          return isSameDay(eventDate, cloneDay);
        });

        const hasImportantEvents = dayEvents.some(event =>
          event.type === 'Krankheit' || event.type === 'Urlaub' || event.priority === 'high'
        );

        const dayCapacity = dayEvents.reduce((total, event) => {
          if (event.startTime && event.endTime) {
            const start = parseInt(event.startTime.split(':')[0]);
            const end = parseInt(event.endTime.split(':')[0]);
            return total + (end - start);
          }
          return total + 8; // Default full day
        }, 0);

        days.push(
          <div
            key={day}
            className={`relative p-2 border-r border-b border-gray-200 transition-all duration-200 ${
              screenSize === 'mobile' ? 'h-20 min-h-[80px]' : screenSize === 'tablet' ? 'h-24 min-h-[96px]' : 'h-28 min-h-[112px]'
            } ${hasImportantEvents ? 'ring-2 ring-red-200' : ''} ${
              !isSameMonth(day, monthStart) ? 'bg-gray-50 opacity-60' : 'bg-white'
            } ${isToday(day) ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-300' : ''} ${
              selectedDate && isSameDay(day, selectedDate) ? 'bg-blue-100 border-blue-300' : ''
            } hover:bg-gray-50 hover:shadow-md cursor-pointer group active:scale-[0.99]`}
            onMouseEnter={() => setHoveredDate(cloneDay)}
            onMouseLeave={() => setHoveredDate(null)}
            onDoubleClick={() => {
              setQuickActionDate(cloneDay);
              setShowQuickActionsModal(true);
            }}
            onClick={() => {
              onDateSelect(cloneDay);
              setNewEvent(prev => ({ ...prev, date: cloneDay }));
            }}
          >
            <div className="flex justify-between items-center mb-1">
              <span className={`text-sm font-medium ${
                isToday(day) ? 'text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-full' : 'text-gray-700'
              }`}>
                {formattedDate}
              </span>
              <div className="flex items-center space-x-1">
                {dayEvents.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    hasImportantEvents ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {dayEvents.length}
                  </span>
                )}
                {dayCapacity > 8 && (
                  <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded-full" title="Überbucht">
                    !
                  </span>
                )}
              </div>
            </div>

            {/* Quick Add Button */}
            {hoveredDate && isSameDay(hoveredDate, cloneDay) && (
              <button
                className="absolute top-1 right-1 w-5 h-5 bg-blue-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickActionDate(cloneDay);
                  setShowQuickActionsModal(true);
                }}
                title="Schnell hinzufügen"
              >
                +
              </button>
            )}

            <div className="space-y-1 overflow-y-auto flex-1">
              {dayEvents.slice(0, screenSize === 'mobile' ? 2 : 3).map((event, index) => {
                const isWaste = isWasteEvent(event);
                const wasteStyle = isWaste ? getWasteTypeStyle(event.waste_type || event.wasteType) : null;

                // Event styling with waste type support
                let eventStyle = {};
                let eventClasses = 'text-xs p-1.5 rounded-md cursor-pointer transition-all hover:shadow-md transform hover:-translate-y-0.5 border-l-3';

                if (isWaste && wasteStyle) {
                  eventStyle = {
                    backgroundColor: `${wasteStyle.color}15`,
                    color: wasteStyle.color,
                    borderLeftColor: wasteStyle.hazardConfig.borderColor,
                    borderLeftWidth: '3px'
                  };
                } else {
                  eventClasses += event.type === 'Arbeit' ? ' bg-green-50 text-green-800 border-green-400 hover:bg-green-100' :
                    event.type === 'Urlaub' ? ' bg-purple-50 text-purple-800 border-purple-400 hover:bg-purple-100' :
                    event.type === 'Krankheit' ? ' bg-red-50 text-red-800 border-red-400 hover:bg-red-100' :
                    event.type === 'Meeting' ? ' bg-blue-50 text-blue-800 border-blue-400 hover:bg-blue-100' :
                    ' bg-gray-50 text-gray-800 border-gray-400 hover:bg-gray-100';
                }

                return (
                  <div
                    key={index}
                    className={eventClasses}
                    style={isWaste && wasteStyle ? eventStyle : {}}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                      setShowEventDetailsModal(true);
                    }}
                    title={isWaste && wasteStyle ?
                      `${wasteStyle.icon} ${event.title} - ${wasteStyle.hazardConfig.badge}` :
                      `${event.title} ${event.startTime ? `(${event.startTime}-${event.endTime})` : ''}`
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      {isWaste && wasteStyle && (
                        <span className="text-sm flex-shrink-0">{wasteStyle.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-1">
                          {event.title}
                          {isWaste && wasteStyle && screenSize !== 'mobile' && (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
                              style={{
                                backgroundColor: wasteStyle.hazardConfig.bgColor,
                                color: wasteStyle.hazardConfig.color,
                                fontSize: '8px'
                              }}
                            >
                              {wasteStyle.hazardConfig.badge}
                            </span>
                          )}
                        </div>
                        {event.startTime && (
                          <div className="text-xs opacity-75 mt-0.5">
                            {event.startTime}-{event.endTime}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {dayEvents.length > (screenSize === 'mobile' ? 2 : 3) && (
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-left pl-1.5 py-1 hover:bg-blue-50 rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateSelect(cloneDay);
                  }}
                >
                  +{dayEvents.length - (screenSize === 'mobile' ? 2 : 3)} weitere
                </button>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={rows.length} className="flex">
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="bg-white rounded-b-lg shadow-sm overflow-hidden animate-fadeIn">
        <div className="grid grid-cols-7 bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10 shadow-sm">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className={`${screenSize === 'mobile' ? 'p-1.5 text-xs' : 'p-2 text-sm'} text-center font-semibold text-gray-700 uppercase tracking-wide`}>
              {screenSize === 'mobile' ? day.charAt(0) : day}
            </div>
          ))}
        </div>
        <div className="transition-all duration-300 ease-in-out">
          {rows}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayEvents = filteredEvents.filter(event => {
        const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
        return isSameDay(eventDate, day);
      });

      days.push(
        <div key={i} className={`flex-1 border-r border-gray-200 last:border-r-0 ${screenSize === 'mobile' ? 'min-w-[100px]' : ''}`}>
          <div className={`p-2 md:p-3 text-center border-b border-gray-200 transition-colors ${
            isToday(day) ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'
          }`}>
            <div className={`${screenSize === 'mobile' ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>
              {format(day, screenSize === 'mobile' ? 'EEE' : 'EEEE', { locale: de }).substring(0, screenSize === 'mobile' ? 2 : 3)}
            </div>
            <div className={`${screenSize === 'mobile' ? 'text-base' : 'text-lg'} font-bold ${
              isToday(day) ? 'text-blue-600 bg-blue-100 w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-gray-900'
            }`}>
              {format(day, 'd')}
            </div>
          </div>

          <div className="h-96 p-2 overflow-y-auto">
            {dayEvents.map((event, index) => {
              const isWaste = isWasteEvent(event);
              const wasteStyle = isWaste ? getWasteTypeStyle(event.waste_type || event.wasteType) : null;

              let eventStyle = {};
              let eventClasses = 'mb-2 p-2 rounded text-xs cursor-pointer transition-all hover:shadow-md transform hover:-translate-y-0.5';

              if (isWaste && wasteStyle) {
                eventStyle = {
                  backgroundColor: `${wasteStyle.color}20`,
                  color: wasteStyle.color,
                  borderLeft: `4px solid ${wasteStyle.hazardConfig.borderColor}`
                };
              } else {
                eventClasses += event.type === 'Arbeit' ? ' bg-green-100 text-green-800' :
                  event.type === 'Urlaub' ? ' bg-purple-100 text-purple-800' :
                  event.type === 'Krankheit' ? ' bg-red-100 text-red-800' :
                  ' bg-gray-100 text-gray-800';
              }

              return (
                <div
                  key={index}
                  className={eventClasses}
                  style={isWaste && wasteStyle ? eventStyle : {}}
                  onClick={() => {
                    setSelectedEvent(event);
                    setShowEventDetailsModal(true);
                  }}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {isWaste && wasteStyle && <span>{wasteStyle.icon}</span>}
                    <span className="flex-1">{event.title}</span>
                    {isWaste && wasteStyle && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                        style={{
                          backgroundColor: wasteStyle.hazardConfig.bgColor,
                          color: wasteStyle.hazardConfig.color
                        }}
                      >
                        {wasteStyle.hazardConfig.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs opacity-75 mt-1">
                    {event.startTime} - {event.endTime}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className={`flex ${screenSize === 'mobile' ? 'overflow-x-auto' : ''}`}>
          {days}
        </div>
      </div>
    );
  };

  const handleEventSubmit = (eventData) => {
    if (onEventCreate && eventData.title) {
      onEventCreate({
        ...eventData,
        id: Date.now(),
        date: eventData.date || selectedDate || new Date()
      });
      setShowEventModal(false);
      setNewEvent({
        title: '',
        description: '',
        startTime: '09:00',
        endTime: '17:00',
        type: 'Arbeit',
        isRecurring: false,
        recurrencePattern: 'weekly'
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {renderHeader()}

      <div className="bg-white border-b border-gray-200">
        {/* Main toolbar */}
        <div className="flex flex-wrap gap-3 items-center justify-between p-3 md:p-4">
          {/* View switcher - responsive */}
          <div className="flex space-x-1 md:space-x-2">
            <button
              onClick={() => viewType !== 'month' && onDateSelect(new Date())}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                viewType === 'month'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {screenSize === 'mobile' ? 'M' : 'Monat'}
            </button>
            <button
              onClick={() => viewType !== 'week' && onDateSelect(new Date())}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                viewType === 'week'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {screenSize === 'mobile' ? 'W' : 'Woche'}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Legend toggle */}
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="px-3 py-2 text-xs md:text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
              title="Legende anzeigen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              {screenSize !== 'mobile' && <span>Legende</span>}
            </button>

            {/* New event button */}
            <button
              onClick={() => {
                setNewEvent({ ...newEvent, date: selectedDate || new Date() });
                setShowEventModal(true);
              }}
              className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg text-xs md:text-sm font-medium flex items-center gap-2 min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {screenSize !== 'mobile' && <span>Neuer Termin</span>}
            </button>
          </div>
        </div>

        {/* Filters - collapsible on mobile */}
        <div className="px-3 md:px-4 pb-3 flex flex-wrap gap-2">
          {/* Category filter */}
          <select
            value={filterCategory || ''}
            onChange={(e) => setFilterCategory(e.target.value || null)}
            className="px-3 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Alle Kategorien</option>
            {wasteCategories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          {/* Waste type filter */}
          <select
            value={filterWasteType || ''}
            onChange={(e) => setFilterWasteType(e.target.value || null)}
            className="px-3 py-1.5 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Alle Abfalltypen</option>
            {Object.entries(WASTE_TEMPLATES).map(([id, template]) => (
              <option key={id} value={id}>
                {template.icon} {template.name}
              </option>
            ))}
          </select>

          {/* Clear filters */}
          {(filterCategory || filterWasteType) && (
            <button
              onClick={() => {
                setFilterCategory(null);
                setFilterWasteType(null);
              }}
              className="px-3 py-1.5 text-xs md:text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      <div
        className="flex-1 overflow-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          viewType === 'month' ? renderMonthView() : renderWeekView()
        )}
      </div>

      {/* Legend Modal */}
      {showLegend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setShowLegend(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-gray-900">Abfalltypen Legende</h3>
              <button
                onClick={() => setShowLegend(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Hazard Levels */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Gefahrenstufen</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(HAZARD_LEVEL_CONFIG).map(([level, config]) => (
                    <div
                      key={level}
                      className="flex items-center gap-2 p-3 rounded-lg border-2"
                      style={{
                        borderColor: config.borderColor,
                        backgroundColor: config.bgColor
                      }}
                    >
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.color }}></div>
                      <span className="text-sm font-medium" style={{ color: config.color }}>
                        {config.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Waste Types by Category */}
              {wasteCategories.map(category => {
                const categoryWastes = Object.entries(WASTE_TEMPLATES).filter(([_, template]) => template.category === category);

                return (
                  <div key={category} className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {categoryWastes.map(([id, template]) => {
                        const hazardConfig = HAZARD_LEVEL_CONFIG[template.hazard_level];
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-3 p-3 rounded-lg border-l-4 transition-all hover:shadow-md cursor-pointer"
                            style={{
                              backgroundColor: `${template.color}10`,
                              borderLeftColor: hazardConfig.borderColor
                            }}
                            onClick={() => {
                              setFilterWasteType(id);
                              setShowLegend(false);
                            }}
                          >
                            <span className="text-2xl flex-shrink-0">{template.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900 truncate">{template.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                                  style={{
                                    backgroundColor: hazardConfig.bgColor,
                                    color: hazardConfig.color
                                  }}
                                >
                                  {hazardConfig.badge}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-2xl">
              <p className="text-xs text-gray-500 text-center">
                Klicken Sie auf einen Abfalltyp, um nach diesem zu filtern
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
          event={newEvent}
          onSave={handleEventSubmit}
          onChange={setNewEvent}
        />
      )}

      {/* Event Details Modal */}
      {showEventDetailsModal && selectedEvent && (
        <EventDetailsModal
          isOpen={showEventDetailsModal}
          onClose={() => setShowEventDetailsModal(false)}
          event={selectedEvent}
          onEdit={(event) => {
            setNewEvent(event);
            setShowEventDetailsModal(false);
            setShowEventModal(true);
          }}
          onDelete={(eventId) => {
            // Handle delete
            setShowEventDetailsModal(false);
          }}
        />
      )}

      {/* Quick Actions Modal */}
      {showQuickActionsModal && quickActionDate && (
        <QuickActionsModal
          isOpen={showQuickActionsModal}
          onClose={() => setShowQuickActionsModal(false)}
          date={quickActionDate}
          onQuickAdd={(eventData) => {
            handleEventSubmit({ ...eventData, date: quickActionDate });
            setShowQuickActionsModal(false);
          }}
        />
      )}
    </div>
  );
};

export default CalendarView;