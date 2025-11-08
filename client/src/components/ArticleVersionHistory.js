import React, { useState, useEffect } from 'react';
import {
  History, RotateCcw, Eye, GitCompare, User, Clock, FileText, ChevronRight, AlertCircle
} from 'lucide-react';
import {
  getArticleVersions,
  getArticleVersion,
  restoreArticleVersion,
  compareArticleVersions
} from '../utils/apiEnhanced';
import { showSuccess, showError } from '../utils/toast';

/**
 * ArticleVersionHistory Component
 * Shows version history with compare and restore functionality
 */
const ArticleVersionHistory = ({ articleId, onClose, currentUser }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    loadVersions();
  }, [articleId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await getArticleVersions(articleId);
      setVersions(response.data);
    } catch (error) {
      console.error('Error loading versions:', error);
      showError('Fehler beim Laden der Versionen');
    } finally {
      setLoading(false);
    }
  };

  const handleViewVersion = async (versionNumber) => {
    try {
      const response = await getArticleVersion(articleId, versionNumber);
      setSelectedVersion(response.data);
    } catch (error) {
      console.error('Error loading version:', error);
      showError('Fehler beim Laden der Version');
    }
  };

  const handleRestoreVersion = async (versionNumber) => {
    if (!window.confirm(`Version ${versionNumber} wirklich wiederherstellen?`)) {
      return;
    }

    try {
      await restoreArticleVersion(articleId, versionNumber);
      showSuccess(`Artikel auf Version ${versionNumber} wiederhergestellt`);
      loadVersions();
      setSelectedVersion(null);
    } catch (error) {
      console.error('Error restoring version:', error);
      showError(error.response?.data?.error || 'Fehler beim Wiederherstellen');
    }
  };

  const handleCompareToggle = (versionNumber) => {
    if (selectedVersions.includes(versionNumber)) {
      setSelectedVersions(selectedVersions.filter(v => v !== versionNumber));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, versionNumber]);
    }
  };

  const handleCompare = async () => {
    if (selectedVersions.length !== 2) {
      showError('Bitte wählen Sie genau 2 Versionen zum Vergleichen');
      return;
    }

    try {
      const [v1, v2] = selectedVersions.sort((a, b) => a - b);
      const response = await compareArticleVersions(articleId, v1, v2);
      setComparison(response.data);
    } catch (error) {
      console.error('Error comparing versions:', error);
      showError('Fehler beim Vergleichen');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (comparison) {
    return (
      <div className="space-y-6">
        {/* Comparison Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCompare className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-bold text-slate-900">
              Vergleich: Version {comparison.version1.version_number} ↔ Version {comparison.version2.version_number}
            </h3>
          </div>
          <button
            onClick={() => {
              setComparison(null);
              setSelectedVersions([]);
              setCompareMode(false);
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Zurück
          </button>
        </div>

        {/* Side by Side Comparison */}
        <div className="grid grid-cols-2 gap-4">
          {[comparison.version1, comparison.version2].map((version, index) => (
            <div key={index} className="p-6 bg-white rounded-xl border-2 border-slate-200">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-blue-600">Version {version.version_number}</span>
                  <span className="text-sm text-slate-500">{formatDate(version.created_at)}</span>
                </div>
                <p className="text-sm text-slate-600">{version.created_by_name}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Titel:</h4>
                  <p className="text-slate-900">{version.title}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Inhalt:</h4>
                  <div
                    className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-lg max-h-96 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: version.content }}
                  />
                </div>

                {version.change_summary && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Änderungen:</h4>
                    <p className="text-sm text-slate-600 italic">{version.change_summary}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selectedVersion) {
    return (
      <div className="space-y-6">
        {/* Version Detail Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-xl font-bold text-slate-900">Version {selectedVersion.version_number}</h3>
              <p className="text-sm text-slate-600">{formatDate(selectedVersion.created_at)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => handleRestoreVersion(selectedVersion.version_number)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Wiederherstellen
              </button>
            )}
            <button
              onClick={() => setSelectedVersion(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Zurück
            </button>
          </div>
        </div>

        {/* Version Content */}
        <div className="p-6 bg-white rounded-xl border-2 border-slate-200 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700">{selectedVersion.created_by_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700">{formatDate(selectedVersion.created_at)}</span>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-bold text-slate-900 mb-2">{selectedVersion.title}</h4>
          </div>

          {selectedVersion.change_summary && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Änderungen:</strong> {selectedVersion.change_summary}
              </p>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-slate-700 mb-3">Inhalt:</h4>
            <div
              className="prose prose-sm max-w-none p-6 bg-slate-50 rounded-lg border border-slate-200"
              dangerouslySetInnerHTML={{ __html: selectedVersion.content }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-900">Versionshistorie</h3>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
            {versions.length} {versions.length === 1 ? 'Version' : 'Versionen'}
          </span>
        </div>

        <div className="flex gap-2">
          {compareMode ? (
            <>
              <button
                onClick={handleCompare}
                disabled={selectedVersions.length !== 2}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                <GitCompare className="w-4 h-4" />
                Vergleichen ({selectedVersions.length}/2)
              </button>
              <button
                onClick={() => {
                  setCompareMode(false);
                  setSelectedVersions([]);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Abbrechen
              </button>
            </>
          ) : (
            <button
              onClick={() => setCompareMode(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              <GitCompare className="w-4 h-4" />
              Vergleichen
            </button>
          )}
        </div>
      </div>

      {/* Version List */}
      <div className="space-y-3">
        {versions.map((version) => (
          <div
            key={version.id}
            className={`p-4 bg-white rounded-xl border-2 transition ${
              compareMode && selectedVersions.includes(version.version_number)
                ? 'border-purple-500 bg-purple-50'
                : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {compareMode && (
                  <input
                    type="checkbox"
                    checked={selectedVersions.includes(version.version_number)}
                    onChange={() => handleCompareToggle(version.version_number)}
                    disabled={!selectedVersions.includes(version.version_number) && selectedVersions.length >= 2}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                  />
                )}

                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
                  v{version.version_number}
                </div>

                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900">{version.title}</h4>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {version.created_by_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(version.created_at)}
                    </span>
                  </div>
                  {version.change_summary && (
                    <p className="text-sm text-slate-500 italic mt-1">{version.change_summary}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewVersion(version.version_number)}
                  className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition"
                  title="Anzeigen"
                >
                  <Eye className="w-5 h-5" />
                </button>

                {isAdmin && (
                  <button
                    onClick={() => handleRestoreVersion(version.version_number)}
                    className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition"
                    title="Wiederherstellen"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {versions.length === 0 && (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Keine Versionen verfügbar</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleVersionHistory;
