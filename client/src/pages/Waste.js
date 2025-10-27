import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import WasteTemplateManager from '../components/WasteTemplateManager';
import { 
  getWasteItems, 
  createWasteItem, 
  updateWasteItem, 
  deleteWasteItem,
  createWasteItem as createWasteFromTemplate
} from '../utils/api';

const Waste = () => {
  const auth = useAuth(); const user = auth?.user;
  const [wasteItems, setWasteItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('items');

  useEffect(() => {
    loadWasteData();
  }, []);

  const loadWasteData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await getWasteItems();
      setWasteItems(response.data);
      
      // Initialize templates
      setTemplates([
        {
          id: 1,
          name: 'Bioabfall',
          description: 'Organische Abfälle aus Küche und Garten',
          disposalInstructions: 'Bioabfallbehälter alle 2 Wochen am Dienstag rausstellen.\nNicht erlaubt: Plastik, Metall, Glas.',
          color: '#A9D08E',
          icon: 'bio',
          defaultFrequency: 'biweekly',
          defaultNextDate: ''
        },
        {
          id: 2,
          name: 'Papiertonne',
          description: 'Altpapier und Kartonagen',
          disposalInstructions: 'Papiertonnen monatlich am Freitag rausstellen.\nNicht erlaubt: verschmutztes Papier, Tapeten, Foto- und Faxpapier.',
          color: '#D9E1F2',
          icon: 'paper',
          defaultFrequency: 'monthly',
          defaultNextDate: ''
        },
        {
          id: 3,
          name: 'Restmüll',
          description: 'Nicht-recyclebare Abfälle',
          disposalInstructions: 'Restmülltonnen wöchentlich am Montag rausstellen.\nNicht erlaubt: Wertstoffe, Elektroschrott, Sondermüll.',
          color: '#F4B084',
          icon: 'trash',
          defaultFrequency: 'weekly',
          defaultNextDate: ''
        },
        {
          id: 4,
          name: 'Gelber Sack',
          description: 'Verpackungen aus Plastik, Metall und Verbundstoffen',
          disposalInstructions: 'Gelbe Säcke alle 2 Wochen am Mittwoch rausstellen.\nNicht erlaubt: Elektroschrott, Batterien, Glas.',
          color: '#FFD700',
          icon: 'plastic',
          defaultFrequency: 'biweekly',
          defaultNextDate: ''
        }
      ]);
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
      loadWasteData();
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
      loadWasteData();
    } catch (err) {
      console.error('Error deleting waste item:', err);
      setError('Fehler beim Löschen der Abfallart. Bitte versuche es erneut.');
    }
  };

  const handleTemplateCreate = (newTemplate) => {
    setTemplates(prev => [...prev, newTemplate]);
  };

  const handleTemplateUpdate = (updatedTemplate) => {
    setTemplates(prev => 
      prev.map(template => 
        template.id === updatedTemplate.id ? updatedTemplate : template
      )
    );
  };

  const handleTemplateDelete = (templateId) => {
    setTemplates(prev => prev.filter(template => template.id !== templateId));
  };

  const handleTemplateApply = async (template) => {
    try {
      // Create waste item from template
      const today = new Date();
      const nextDate = template.defaultNextDate || new Date(today.setDate(today.getDate() + 7));
      
      await createWasteFromTemplate(
        template.name,
        template.description,
        template.disposalInstructions,
        typeof nextDate === 'string' ? nextDate : nextDate.toISOString().split('T')[0]
      );
      
      // Refresh waste items
      loadWasteData();
      
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Abfallmanagement
        </h1>
        <p className="text-gray-600">
          Verwalte Abfallarten, Vorlagen und Entsorgungstermine
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'items'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Abfallarten
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Vorlagen
          </button>
        </nav>
      </div>

      {activeTab === 'items' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {wasteItems.map(item => (
            <div 
              key={item.id} 
              className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-800">
                    {item.name}
                  </h3>
                  {['admin', 'superadmin'].includes(user.role) && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleUpdateWasteItem(
                          item.id, 
                          item.name, 
                          item.description, 
                          item.disposal_instructions, 
                          item.next_disposal_date
                        )}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Bearbeiten"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteWasteItem(item.id)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        title="Löschen"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                
                {item.description && (
                  <p className="text-gray-600 mb-4 text-sm">
                    {item.description}
                  </p>
                )}
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-700 text-sm mb-1">Entsorgungsanleitung</h4>
                    <p className="text-gray-600 text-sm whitespace-pre-line">
                      {item.disposal_instructions}
                    </p>
                  </div>
                  
                  {item.next_disposal_date && (
                    <div>
                      <h4 className="font-medium text-gray-700 text-sm mb-1">Nächster Termin</h4>
                      <p className="text-gray-600 text-sm">
                        {new Date(item.next_disposal_date).toLocaleDateString('de-DE', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {wasteItems.length === 0 && (
            <div className="col-span-full bg-white rounded-xl shadow-sm p-8 text-center border-2 border-dashed border-gray-300">
              <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Abfallarten vorhanden</h3>
              <p className="text-gray-500 mb-4">
                {['admin', 'superadmin'].includes(user.role)
                  ? 'Erstelle neue Abfallarten oder wende Vorlagen an' 
                  : 'Derzeit sind keine Abfallarten definiert'}
              </p>
              {['admin', 'superadmin'].includes(user.role) && (
                <button
                  onClick={() => setActiveTab('templates')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Vorlagen anzeigen
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'templates' && (
        <WasteTemplateManager
          templates={templates}
          onTemplateCreate={handleTemplateCreate}
          onTemplateUpdate={handleTemplateUpdate}
          onTemplateDelete={handleTemplateDelete}
          onTemplateApply={handleTemplateApply}
        />
      )}
    </div>
  );
};

export default Waste;
