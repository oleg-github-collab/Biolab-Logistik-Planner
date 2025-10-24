import React, { useState } from 'react';

const ConflictDialog = ({ conflicts, onResolve, onCancel, lockedBy }) => {
  const [choices, setChoices] = useState({});
  const [strategy, setStrategy] = useState('last-write-wins');

  const handleChoiceChange = (field, value) => {
    setChoices(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleResolve = () => {
    if (strategy === 'user-choice') {
      // Ensure all conflicts are resolved
      const allResolved = conflicts.every(conflict =>
        choices[conflict.field] !== undefined
      );

      if (!allResolved) {
        alert('Bitte lösen Sie alle Konflikte');
        return;
      }

      const resolutions = Object.entries(choices).map(([field, selectedValue]) => ({
        field,
        selectedValue
      }));

      onResolve({ strategy, resolutions });
    } else {
      onResolve({ strategy });
    }
  };

  if (lockedBy) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-scaleIn">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-orange-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  Element wird bearbeitet
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Wird gerade von {lockedBy.userName} bearbeitet
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">Bearbeitung läuft</p>
                  <p className="text-yellow-700 mt-1">
                    Die Sperre läuft in {Math.ceil(lockedBy.expiresIn / 1000)} Sekunden ab
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={() => onResolve({ strategy: 'force' })}
                className="flex-1 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                Trotzdem bearbeiten
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-scaleIn">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">
                Änderungskonflikte erkannt
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {conflicts.length} Feld{conflicts.length > 1 ? 'er' : ''} wurde{conflicts.length > 1 ? 'n' : ''} gleichzeitig geändert
              </p>
            </div>
          </div>
        </div>

        {/* Strategy Selector */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Auflösungsstrategie wählen:
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
              <input
                type="radio"
                name="strategy"
                value="last-write-wins"
                checked={strategy === 'last-write-wins'}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Neueste Version übernehmen</div>
                <div className="text-sm text-gray-600">Alle neuen Änderungen werden übernommen</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
              <input
                type="radio"
                name="strategy"
                value="user-choice"
                checked={strategy === 'user-choice'}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Manuell auswählen</div>
                <div className="text-sm text-gray-600">Für jedes Feld selbst entscheiden</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-white transition-colors">
              <input
                type="radio"
                name="strategy"
                value="keep-current"
                checked={strategy === 'keep-current'}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Meine Version behalten</div>
                <div className="text-sm text-gray-600">Alle aktuellen Werte beibehalten</div>
              </div>
            </label>
          </div>
        </div>

        {/* Conflict Details */}
        {strategy === 'user-choice' && (
          <div className="p-6 overflow-y-auto max-h-96">
            <h4 className="font-semibold text-gray-900 mb-4">Konflikte lösen:</h4>
            <div className="space-y-4">
              {conflicts.map((conflict, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    {conflict.field}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors bg-white">
                      <input
                        type="radio"
                        name={`conflict-${index}`}
                        value="current"
                        checked={choices[conflict.field] === conflict.currentValue}
                        onChange={() => handleChoiceChange(conflict.field, conflict.currentValue)}
                        className="mt-1 w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 mb-1">Ihre Version:</div>
                        <div className="text-sm text-gray-900 bg-blue-50 p-2 rounded border border-blue-200 break-words">
                          {typeof conflict.currentValue === 'object'
                            ? JSON.stringify(conflict.currentValue, null, 2)
                            : String(conflict.currentValue || '-')}
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-green-500 transition-colors bg-white">
                      <input
                        type="radio"
                        name={`conflict-${index}`}
                        value="incoming"
                        checked={choices[conflict.field] === conflict.incomingValue}
                        onChange={() => handleChoiceChange(conflict.field, conflict.incomingValue)}
                        className="mt-1 w-4 h-4 text-green-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 mb-1">Neue Version:</div>
                        <div className="text-sm text-gray-900 bg-green-50 p-2 rounded border border-green-200 break-words">
                          {typeof conflict.incomingValue === 'object'
                            ? JSON.stringify(conflict.incomingValue, null, 2)
                            : String(conflict.incomingValue || '-')}
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={handleResolve}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-600/30"
          >
            Konflikte auflösen
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictDialog;
