import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Calendar from '../components/Calendar';
import ScheduleForm from '../components/ScheduleForm';
import { 
  getCurrentWeek, 
  getMySchedule, 
  updateDaySchedule, 
  getTeamSchedule,
  getArchivedSchedules
} from '../utils/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(null);
  const [mySchedule, setMySchedule] = useState([]);
  const [teamSchedule, setTeamSchedule] = useState([]);
  const [archivedSchedules, setArchivedSchedules] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayData, setSelectedDayData] = useState(null);
  const [activeTab, setActiveTab] = useState('my-schedule');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Define loadData with useCallback to make it stable
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const [weekRes, scheduleRes, teamRes, archivedRes] = await Promise.all([
        getCurrentWeek(),
        getMySchedule(),
        // FIX: Replaced invalid syntax { [] } with a valid object matching the expected data structure.
        user.role === 'admin' ? getTeamSchedule() : Promise.resolve({ data: [] }),
        getArchivedSchedules()
      ]);
      
      setCurrentWeek(weekRes.data);
      setMySchedule(scheduleRes.data);
      setTeamSchedule(teamRes.data || []);
      setArchivedSchedules(archivedRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Fehler beim Laden der Daten. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  }, [user.role]); // Add user.role as dependency since it's used in the function

  useEffect(() => {
    loadData();
  }, [loadData]); // Now loadData is a dependency, which is correct

  useEffect(() => {
    if (mySchedule && selectedDay) {
      const dayIndex = selectedDay.getDay() === 0 ? 6 : selectedDay.getDay() - 1; // Adjust for Monday = 0
      const dayData = mySchedule.find(item => item.dayOfWeek === dayIndex);
      setSelectedDayData({
        ...dayData,
        dayName: selectedDay.toLocaleDateString('de-DE', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'numeric',
          year: 'numeric'
        })
      });
    }
  }, [selectedDay, mySchedule]);

  const handleDaySelect = (day) => {
    setSelectedDay(day);
  };

  const handleUpdateSchedule = async (dayOfWeek, startTime, endTime, status) => {
    try {
      await updateDaySchedule(dayOfWeek, startTime, endTime, status);
      // Refresh data
      const scheduleRes = await getMySchedule();
      setMySchedule(scheduleRes.data);
    } catch (err) {
      console.error('Error updating schedule:', err);
      setError('Fehler beim Aktualisieren des Plans. Bitte versuche es erneut.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-biolab-blue mx-auto"></div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-biolab-dark mb-2">
          {currentWeek?.weekName || 'Aktuelle Woche'}
        </h2>
        <p className="text-gray-600">
          Plane deine Arbeitszeiten für diese Woche
        </p>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('my-schedule')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'my-schedule'
                  ? 'border-biolab-blue text-biolab-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mein Plan
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => setActiveTab('team-schedule')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'team-schedule'
                    ? 'border-biolab-blue text-biolab-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Team-Plan
              </button>
            )}
            <button
              onClick={() => setActiveTab('archive')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'archive'
                  ? 'border-biolab-blue text-biolab-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Archiv
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'my-schedule' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Calendar
              weekStart={currentWeek?.weekStart}
              selectedDay={selectedDay}
              onDaySelect={handleDaySelect}
              scheduleData={mySchedule}
            />
          </div>
          <div>
            <ScheduleForm
              dayData={selectedDayData}
              onUpdate={handleUpdateSchedule}
            />
          </div>
        </div>
      )}

      {activeTab === 'team-schedule' && user.role === 'admin' && (
        <div className="space-y-6">
          {teamSchedule.map((member, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold text-biolab-dark mb-4">
                {member.user}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tag
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Startzeit
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Endzeit
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {member.schedule.map((day, dayIndex) => (
                      <tr key={dayIndex} className={day.status === 'Abwesend' ? 'bg-gray-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {day.dayName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {day.startTime || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {day.endTime || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            day.status === 'Arbeit' ? 'bg-biolab-green text-white' :
                            day.status === 'Urlaub' ? 'bg-biolab-purple text-gray-800' :
                            day.status === 'Krankheit' ? 'bg-biolab-orange text-white' :
                            'bg-gray-300 text-gray-800'
                          }`}>
                            {day.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="space-y-6">
          {archivedSchedules.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keine archivierten Pläne vorhanden</h3>
              <p className="text-gray-500">
                Archivierte Wochenpläne werden hier angezeigt, nachdem sie abgelaufen sind.
              </p>
            </div>
          ) : (
            archivedSchedules.map((archive, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold text-biolab-dark mb-4">
                  Archiviert am: {formatDate(archive.archivedAt)}
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tag
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Startzeit
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Endzeit
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {archive.data.map((day, dayIndex) => (
                        <tr key={dayIndex} className={day.status === 'Abwesend' ? 'bg-gray-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {new Date(day.week_start).toLocaleDateString('de-DE', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {day.start_time || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {day.end_time || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              day.status === 'Arbeit' ? 'bg-biolab-green text-white' :
                              day.status === 'Urlaub' ? 'bg-biolab-purple text-gray-800' :
                              day.status === 'Krankheit' ? 'bg-biolab-orange text-white' :
                              'bg-gray-300 text-gray-800'
                            }`}>
                              {day.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;