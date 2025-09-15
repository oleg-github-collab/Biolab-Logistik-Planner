import React, { useState } from 'react';
import { format } from 'date-fns';

const WasteManagement = ({ 
  wasteItems, 
  onCreate, 
  onUpdate, 
  onDelete, 
  isAdmin 
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    disposalInstructions: '',
    nextDisposalDate: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      onUpdate(editingItem.id, formData.name, formData.description, formData.disposalInstructions, formData.nextDisposalDate);
      setEditingItem(null);
    } else {
      onCreate(formData.name, formData.description, formData.disposalInstructions, formData.nextDisposalDate);
    }
    setFormData({
      name: '',
      description: '',
      disposalInstructions: '',
      nextDisposalDate: ''
    });
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      disposalInstructions: item.disposal_instructions,
      nextDisposalDate: item.next_disposal_date || ''
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      disposalInstructions: '',
      nextDisposalDate: ''
    });
  };

  const getStatusColor = (date) => {
    if (!date) return 'bg-gray-200';
    const today = new Date();
    const disposalDate = new Date(date);
    const diffTime = disposalDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'bg-red-200'; // Past due
    if (diffDays <= 3) return 'bg-orange-200'; // Due soon
    if (diffDays <= 7) return 'bg-yellow-200'; // Due this week
    return 'bg-green-200'; // Future
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-biolab-dark">
              {editingItem ? 'Abfallart bearbeiten' : 'Neue Abfallart hinzufügen'}
            </h3>
            {showForm && (
              <button
                onClick={handleCancel}
                className="text-red-500 hover:text-red-700 font-medium"
              >
                Abbrechen
              </button>
            )}
          </div>
          
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                  placeholder="z.B. Bioabfall"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschreibung
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                  placeholder="Optionale Beschreibung"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entsorgungsanleitung *
                </label>
                <textarea
                  name="disposalInstructions"
                  value={formData.disposalInstructions}
                  onChange={handleInputChange}
                  required
                  rows="3"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                  placeholder="Wie muss dieser Abfall entsorgt werden?"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nächster Entsorgungstermin
                </label>
                <input
                  type="date"
                  name="nextDisposalDate"
                  value={formData.nextDisposalDate}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                />
              </div>
              
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
                  {editingItem ? 'Aktualisieren' : 'Hinzufügen'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="bg-biolab-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Neue Abfallart hinzufügen
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {wasteItems.map(item => (
          <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className={`p-4 ${getStatusColor(item.next_disposal_date)}`}>
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold text-biolab-dark">{item.name}</h3>
                {isAdmin && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title="Bearbeiten"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-red-500 hover:text-red-700 p-1"
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
                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
              )}
              
              {item.next_disposal_date && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Nächster Termin:</span>{' '}
                  {format(new Date(item.next_disposal_date), 'dd.MM.yyyy')}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-2">Entsorgungsanleitung:</h4>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {item.disposal_instructions}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {wasteItems.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Abfallarten vorhanden</h3>
          <p className="text-gray-500">
            {isAdmin 
              ? 'Füge neue Abfallarten hinzu, um das Entsorgungsmanagement zu beginnen.' 
              : 'Derzeit sind keine Abfallarten definiert.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default WasteManagement;