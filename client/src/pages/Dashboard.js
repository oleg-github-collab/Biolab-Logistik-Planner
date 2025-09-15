import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import CalendarView from '../components/CalendarView';
import KanbanBoard from '../components/KanbanBoard';
import WasteTemplateManager from '../components/WasteTemplateManager'; // FIX: Added missing import
import { 
  getCurrentWeek, 
  getMySchedule, 
  updateDaySchedule, 
  getTeamSchedule,
  getArchivedSchedules,
  updateWasteItem,
  createWasteItem
} from '../utils/api';
import { format, addDays, subDays, parseISO } from 'date-fns';

const Dashboard = () => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(null);
  const [mySchedule, setMySchedule] = useState([]);
  const [teamSchedule, setTeamSchedule] = useState([]);
  const [archivedSchedules, setArchivedSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calendarView, setCalendarView] = useState('month');
  const [tasks, setTasks] = useState([]);
  const [wasteTemplates, setWasteTemplates] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const [weekRes, scheduleRes, teamRes, archivedRes] = await Promise.all([
        getCurrentWeek(),
        getMySchedule(),
        // FIX: Replaced invalid JavaScript syntax { [] } with a valid object { data: [] }
        user.role === 'admin' ? getTeamSchedule() : Promise.resolve({ data: [] }),
        getArchivedSchedules()
      ]);
      
      setCurrentWeek(weekRes.data);
      setMySchedule(scheduleRes.data || []);
      setTeamSchedule(teamRes.data || []);
      setArchivedSchedules(archivedRes.data || []);
      
      // FIX: The 'events' variable was declared here but never used. It has been removed.
      // The CalendarView component below already creates the event list from the 'mySchedule' prop.
      
      setTasks([
        {
          id: 1,
          title: 'Wochenplanung abschließen',
          description: 'Stelle sicher, dass alle Arbeitszeiten für die kommende Woche eingetragen sind',
          status: 'todo',
          priority: 'high',
          assignee: user.name,
          dueDate: new Date(),
          tags: ['planung', 'dringend']
        },
        {
          id: 2,
          title: 'Abfallentsorgung planen',
          description: 'Überprüfe die nächsten Entsorgungstermine für alle Abfallarten',
          status: 'inprogress',
          priority: 'medium',
          assignee: user.name,
          dueDate: addDays(new Date(), 3),
          tags: ['abfall', 'logistik']
        }
      ]);
      
      setWasteTemplates([
        {
          id: 1,
          name: 'Bioabfall',
          description: 'Organische Abfälle aus Küche und Garten',
          disposalInstructions: 'Bioabfallbehälter alle 2 Wochen am Dienstag rausstellen.\nNicht erlaubt: Plastik, Metall, Glas.',
          color: '#A9D08E',
          icon: 'bio',
          defaultFrequency: 'biweekly',
          defaultNextDate: format(addDays(new Date(), 7), 'yyyy-MM-dd')
        },
        {
          id: 2,
          name: 'Papiermüll',
          description: 'Altpapier und Kartonagen',
          disposalInstructions: 'Papiertonnen monatlich am Freitag rausstellen.\nNicht erlaubt: verschmutztes Papier, Tapeten, Foto- und Faxpapier.',
          color: '#D9E1F2',
          icon: 'paper',
          defaultFrequency: 'monthly',
          defaultNextDate: format(addDays(new Date(), 14), 'yyyy-MM-dd')
        },
        {
          id: 3,
          name: 'Restmüll',
          description: 'Nicht-recyclebare Abfälle',
          disposalInstructions: 'Restmülltonnen wöchentlich am Montag rausstellen.\nNicht erlaubt: Wertstoffe, Elektroschrott, Sondermüll.',
          color: '#F4B084',
          icon: 'trash',
          defaultFrequency: 'weekly',
          defaultNextDate: format(new Date(), 'yyyy-MM-dd')
        }
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Fehler beim Laden der Daten. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleEventClick = (event) => {
    console.log('Event clicked:', event);
  };

  const handleEventCreate = async (newEvent) => {
    try {
      // Convert event back to schedule format
      const dayOfWeek = newEvent.date.getDay() === 0 ? 6 : newEvent.date.getDay() - 1;
      const status = newEvent.type;
      const startTime = newEvent.startTime;
      const endTime = newEvent.endTime;
      
      await updateDaySchedule(dayOfWeek, startTime, endTime, status);
      loadData(); // Refresh data
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Fehler beim Erstellen des Termins.');
    }
  };

  const handleTaskUpdate = (taskId, updates) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const handleTaskCreate = (newTask) => {
    setTasks(prev => [...prev, { ...newTask, id: Date.now() }]);
  };

  const handleTaskDelete = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const handleTemplateCreate = (newTemplate) => {
    setWasteTemplates(prev => [...prev, { ...newTemplate, id: Date.now() }]);
  };

  const handleTemplateUpdate = (updatedTemplate) => {
    setWasteTemplates(prev => 
      prev.map(template => 
        template.id === updatedTemplate.id ? updatedTemplate : template
      )
    );
  };

  const handleTemplateDelete = (templateId) => {
    setWasteTemplates(prev => prev.filter(template => template.id !== templateId));
  };

  const handleTemplateApply = async (template) => {
    try {
      // Create waste item from template
      await createWasteItem(
        template.name,
        template.description,
        template.disposalInstructions,
        template.defaultNextDate
      );
      
      // Show success message
      alert(`Vorlage "${template.name}" erfolgreich angewendet!`);
    } catch (err) {
      console.error('Error applying template:', err);
      setError('Fehler beim Anwenden der Vorlage.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="mt-4 text-gray-600">Daten werden geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600">
          Willkommen zurück, {user.name}! Hier ist dein Überblick für heute.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'calendar'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Kalender
          </button>
          <button
            onClick={() => setActiveTab('kanban')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'kanban'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Kanban Board
          </button>
          <button
            onClick={() => setActiveTab('waste-templates')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'waste-templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Abfall-Vorlagen
          </button>
        </nav>
      </div>

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Arbeitszeiten-Kalender</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setCalendarView('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  calendarView === 'month' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Monat
              </button>
              <button
                onClick={() => setCalendarView('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  calendarView === 'week' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Woche
              </button>
            </div>
          </div>
          
          <div className="h-[700px]">
            <CalendarView
              events={mySchedule && currentWeek ? mySchedule.map(day => ({
                id: day.id || `${day.dayOfWeek}-${day.status}`,
                title: day.status,
                date: addDays(new Date(currentWeek.weekStart), day.dayOfWeek),
                startTime: day.startTime,
                endTime: day.endTime,
                type: day.status,
                allDay: !day.startTime && !day.endTime
              })) : []}
              onDateSelect={handleDateSelect}
              onEventClick={handleEventClick}
              selectedDate={selectedDate}
              viewType={calendarView}
              onEventCreate={handleEventCreate}
            />
          </div>
        </div>
      )}

      {/* Kanban Board */}
      {activeTab === 'kanban' && (
        <KanbanBoard
          tasks={tasks}
          onTaskUpdate={handleTaskUpdate}
          onTaskCreate={handleTaskCreate}
          onTaskDelete={handleTaskDelete}
        />
      )}

      {/* Waste Templates */}
      {activeTab === 'waste-templates' && (
        <WasteTemplateManager
          templates={wasteTemplates}
          onTemplateCreate={handleTemplateCreate}
          onTemplateUpdate={handleTemplateUpdate}
          onTemplateDelete={handleTemplateDelete}
          onTemplateApply={handleTemplateApply}
        />
      )}
    </div>
  );
};

export default Dashboard;