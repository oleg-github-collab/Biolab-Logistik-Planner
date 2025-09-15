import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import WasteManagement from '../components/WasteManagement';
import { 
  getWasteItems, 
  createWasteItem, 
  updateWasteItem, 
  deleteWasteItem 
} from '../utils/api';

const Waste = () => {
  const { user } = useAuth();
  const [wasteItems, setWasteItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadWasteItems();
  }, []);

  const loadWasteItems = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await getWasteItems();
      setWasteItems(response.data);
    } catch (err) {
      console.error('Error loading waste items:', err);
      setError('Fehler beim Laden der Abfallarten. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWasteItem = async (name, description, disposalInstructions, nextDisposalDate) => {
    try {
      const response = await createWasteItem(name, description, disposalInstructions, nextDisposalDate);
      setWasteItems(prev => [...prev, response.data]);
    } catch (err) {
      console.error('Error creating waste item:', err);
      setError('Fehler beim Erstellen der Abfallart. Bitte versuche es erneut.');
    }
  };

  const handleUpdateWasteItem = async (id, name, description, disposalInstructions, nextDisposalDate) => {
    try {
      await updateWasteItem(id, name, description, disposalInstructions, nextDisposalDate);
      // Refresh list
      loadWasteItems();
    } catch (err) {
      console.error('Error updating waste item:', err);
      setError('Fehler beim Aktualisieren der Abfallart. Bitte versuche es erneut.');
    }
  };

  const handleDeleteWasteItem = async (id) => {
    if (!window.confirm('Bist du sicher, dass du diese Abfallart löschen möchtest?')) {
      return;
    }
    
    try {
      await deleteWasteItem(id);
      // Refresh list
      loadWasteItems();
    } catch (err) {
      console.error('Error deleting waste item:', err);
      setError('Fehler beim Löschen der Abfallart. Bitte versuche es erneut.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-biolab-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Abfallarten werden geladen...</p>
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
          Abfallmanagement
        </h2>
        <p className="text-gray-600">
          Verwalte Abfallarten und Entsorgungstermine
        </p>
      </div>

      <WasteManagement
        wasteItems={wasteItems}
        onCreate={handleCreateWasteItem}
        onUpdate={handleUpdateWasteItem}
        onDelete={handleDeleteWasteItem}
        isAdmin={user.role === 'admin'}
      />
    </div>
  );
};

export default Waste;