import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import KanbanBoard from '../components/KanbanBoard';
import api from '../utils/api';
import toast from 'react-hot-toast';

const Kanban = () => {
  const { state } = useAuth();
  const { user } = state;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tasks');
      setTasks(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Aufgaben:', error);
      toast.error('Fehler beim Laden der Aufgaben');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreate = async (taskData) => {
    try {
      const response = await api.post('/tasks', taskData);
      setTasks([...tasks, response.data]);
      toast.success('Aufgabe erstellt');
      return response.data;
    } catch (error) {
      console.error('Fehler beim Erstellen der Aufgabe:', error);
      toast.error('Fehler beim Erstellen der Aufgabe');
      throw error;
    }
  };

  const handleTaskUpdate = async (taskId, updates) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, updates);
      setTasks(tasks.map(task => task.id === taskId ? response.data : task));
      toast.success('Aufgabe aktualisiert');
      return response.data;
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Aufgabe:', error);
      toast.error('Fehler beim Aktualisieren der Aufgabe');
      throw error;
    }
  };

  const handleTaskDelete = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(tasks.filter(task => task.id !== taskId));
      toast.success('Aufgabe gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen der Aufgabe:', error);
      toast.error('Fehler beim Löschen der Aufgabe');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Aufgabenverwaltung (Kanban Board)
          </h1>
          <p className="text-gray-600">
            Verwalten Sie Ihre Aufgaben mit Drag & Drop
          </p>
        </div>

        <KanbanBoard
          tasks={tasks}
          onTaskCreate={handleTaskCreate}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
        />
      </div>
    </div>
  );
};

export default Kanban;
