import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, updateUser, deleteUser } from '../utils/api';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (['admin', 'superadmin'].includes(user.role)) {
      loadUsers();
    }
  }, [user.role]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAllUsers();
      setUsers(response.data);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Fehler beim Laden der Benutzer. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email');
      return;
    }
    
    if (formData.password && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setError('');
      const userData = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };
      
      // Only include password if it's provided
      if (formData.password) {
        userData.password = formData.password;
      }
      
      await updateUser(editingUser?.id || 0, userData);
      setShowAddUserForm(false);
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'employee',
        password: '',
        confirmPassword: ''
      });
      loadUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern des Benutzers.');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      confirmPassword: ''
    });
    setShowAddUserForm(true);
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Bist du sicher, dass du den Benutzer "${userName}" löschen möchtest?`)) {
      return;
    }
    
    try {
      await deleteUser(userId);
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Fehler beim Löschen des Benutzers.');
    }
  };

  const handleCancel = () => {
    setShowAddUserForm(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'employee',
      password: '',
      confirmPassword: ''
    });
    setError('');
  };

  if (!['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
          Du hast keine Berechtigung, diese Seite anzuzeigen.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-biolab-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Benutzer werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-biolab-dark mb-2">
          Benutzerverwaltung
        </h2>
        <p className="text-gray-600">
          Verwalte alle Benutzer des Systems
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({
              name: '',
              email: '',
              role: 'employee',
              password: '',
              confirmPassword: ''
            });
            setShowAddUserForm(true);
          }}
          className="bg-biolab-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          Neuen Benutzer hinzufügen
        </button>
      </div>

      {showAddUserForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold text-biolab-dark mb-4">
            {editingUser ? 'Benutzer bearbeiten' : 'Neuen Benutzer erstellen'}
          </h3>
          
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-Mail *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rolle *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
              >
                <option value="employee">Mitarbeiter</option>
                <option value="admin">Administrator</option>
                {user.role === 'superadmin' && (
                  <option value="superadmin">Superadministrator</option>
                )}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passwort {editingUser ? '(optional)' : '*'}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                placeholder={editingUser ? "Nur bei Änderung ausfüllen" : "Mindestens 6 Zeichen"}
              />
            </div>
            
            {formData.password && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Passwort bestätigen *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required={!!formData.password}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="bg-biolab-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
              >
                {editingUser ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  E-Mail
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rolle
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Erstellt am
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((userItem) => (
                <tr key={userItem.id} className={userItem.id === user.id ? 'bg-blue-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {userItem.name}
                    {userItem.id === user.id && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Du
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {userItem.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      userItem.role === 'superadmin'
                        ? 'bg-indigo-100 text-indigo-700'
                        : userItem.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                    }`}>
                      {userItem.role === 'superadmin'
                        ? 'Superadministrator'
                        : userItem.role === 'admin'
                          ? 'Administrator'
                          : 'Mitarbeiter'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(userItem.created_at).toLocaleDateString('de-DE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditUser(userItem)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Bearbeiten
                      </button>
                      {userItem.id !== user.id && (
                        <button
                          onClick={() => handleDeleteUser(userItem.id, userItem.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Löschen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {users.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center mt-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Benutzer vorhanden</h3>
          <p className="text-gray-500">
            Füge neue Benutzer hinzu, um das System zu konfigurieren
          </p>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
