import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Users, X, ChevronRight } from 'lucide-react';
import { checkEventConflict } from '../utils/apiEnhanced';

/**
 * EventConflictWarning Component
 * Shows warning when creating/editing events that conflict with existing ones
 */
const EventConflictWarning = ({ startTime, endTime, eventId = null }) => {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (startTime && endTime) {
      checkConflicts();
    } else {
      setConflicts([]);
    }
  }, [startTime, endTime, eventId]);

  const checkConflicts = async () => {
    setLoading(true);
    try {
      const response = await checkEventConflict({
        start_time: startTime,
        end_time: endTime,
        event_id: eventId
      });

      if (response.data.hasConflict) {
        setConflicts(response.data.conflicts);
      } else {
        setConflicts([]);
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (datetime) => {
    return new Date(datetime).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 border-red-300 text-red-900';
      case 'medium':
        return 'bg-orange-50 border-orange-300 text-orange-900';
      case 'low':
        return 'bg-yellow-50 border-yellow-300 text-yellow-900';
      default:
        return 'bg-slate-50 border-slate-300 text-slate-900';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟠';
      case 'low':
        return '🟡';
      default:
        return 'ℹ️';
    }
  };

  if (loading) {
    return (
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
        <span className="text-sm text-slate-600">Prüfe Konflikte...</span>
      </div>
    );
  }

  if (conflicts.length === 0) return null;

  const highSeverityCount = conflicts.filter(c => c.severity === 'high').length;
  const mediumSeverityCount = conflicts.filter(c => c.severity === 'medium').length;
  const lowSeverityCount = conflicts.filter(c => c.severity === 'low').length;

  return (
    <div className={`rounded-lg border-2 ${
      highSeverityCount > 0 ? 'bg-red-50 border-red-300' :
      mediumSeverityCount > 0 ? 'bg-orange-50 border-orange-300' :
      'bg-yellow-50 border-yellow-300'
    }`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-6 h-6 flex-shrink-0 ${
              highSeverityCount > 0 ? 'text-red-600' :
              mediumSeverityCount > 0 ? 'text-orange-600' :
              'text-yellow-600'
            }`} />
            <div>
              <h4 className={`font-bold text-lg ${
                highSeverityCount > 0 ? 'text-red-900' :
                mediumSeverityCount > 0 ? 'text-orange-900' :
                'text-yellow-900'
              }`}>
                Terminkonflikt erkannt!
              </h4>
              <p className={`text-sm mt-1 ${
                highSeverityCount > 0 ? 'text-red-700' :
                mediumSeverityCount > 0 ? 'text-orange-700' :
                'text-yellow-700'
              }`}>
                {conflicts.length === 1
                  ? 'Dieser Termin überschneidet sich mit 1 anderen Termin'
                  : `Dieser Termin überschneidet sich mit ${conflicts.length} anderen Terminen`}
              </p>

              {/* Severity Summary */}
              <div className="flex gap-3 mt-2">
                {highSeverityCount > 0 && (
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold">
                    🔴 {highSeverityCount} Kritisch
                  </span>
                )}
                {mediumSeverityCount > 0 && (
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-semibold">
                    🟠 {mediumSeverityCount} Mittel
                  </span>
                )}
                {lowSeverityCount > 0 && (
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
                    🟡 {lowSeverityCount} Niedrig
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`p-2 rounded-lg transition ${
              highSeverityCount > 0 ? 'hover:bg-red-100 text-red-700' :
              mediumSeverityCount > 0 ? 'hover:bg-orange-100 text-orange-700' :
              'hover:bg-yellow-100 text-yellow-700'
            }`}
          >
            <ChevronRight className={`w-5 h-5 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Conflict Details */}
      {showDetails && (
        <div className="border-t border-current/20 p-4 space-y-3">
          {conflicts.map((conflict, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${getSeverityColor(conflict.severity)}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{getSeverityIcon(conflict.severity)}</span>
                <div className="flex-1">
                  <h5 className="font-semibold text-sm mb-1">{conflict.title}</h5>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(conflict.start_time)} - {formatTime(conflict.end_time)}</span>
                    </div>

                    {conflict.creator_name && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        <span>Erstellt von: {conflict.creator_name}</span>
                      </div>
                    )}

                    {conflict.overlap && (
                      <div className="mt-2 p-2 bg-white/50 rounded border border-current/20">
                        <p className="font-semibold mb-1">Überschneidung:</p>
                        <p>{formatTime(conflict.overlap.start)} - {formatTime(conflict.overlap.end)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventConflictWarning;
