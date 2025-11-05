import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Scan,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Camera,
  QrCode,
  RefreshCw,
  Trash2,
  Clock,
  ClipboardList,
  StopCircle
} from 'lucide-react';
import { getStorageBins, createStorageBins, completeStorageBin } from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    return String(value);
  }
};

const isDueSoon = (dateValue, days = 3) => {
  if (!dateValue) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return false;
  const threshold = new Date(today);
  threshold.setDate(today.getDate() + days);
  return target >= today && target <= threshold;
};

const KistenManager = () => {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState([]);
  const [manualCode, setManualCode] = useState('');
  const [comment, setComment] = useState('');
  const [keepUntil, setKeepUntil] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [detectorSupported, setDetectorSupported] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [processingId, setProcessingId] = useState(null);

  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const scanningRef = useRef(false);

  const loadBins = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getStorageBins();
      const fetchedBins = response.data?.bins || [];
      setBins(fetchedBins);
    } catch (error) {
      console.error('Error loading storage bins', error);
      showError('Kisten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetectorSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
  }, []);

  useEffect(() => {
    loadBins();
    return () => {
      stopScanning();
    };
  }, [loadBins, stopScanning]);

  const addCode = useCallback((rawCode) => {
    if (!rawCode) return;
    const normalized = String(rawCode).trim();
    if (!normalized) return;
    setCodes((prev) => {
      if (prev.includes(normalized)) {
        return prev;
      }
      showSuccess(`Code erfasst: ${normalized}`);
      return [...prev, normalized];
    });
  }, []);

  const removeCode = (code) => {
    setCodes((prev) => prev.filter((entry) => entry !== code));
  };

  const clearCodes = () => {
    setCodes([]);
  };

  const handleManualAdd = () => {
    const parts = manualCode
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) {
      showError('Bitte einen oder mehrere Codes eingeben.');
      return;
    }

    parts.forEach(addCode);
    setManualCode('');
  };

  const detectLoop = async () => {
    if (!scanningRef.current || !detectorRef.current || !videoRef.current) {
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      barcodes.forEach((barcode) => {
        if (barcode?.rawValue) {
          addCode(barcode.rawValue);
        }
      });
    } catch (error) {
      console.warn('Barcode-Erkennung fehlgeschlagen', error);
    }

    if (scanningRef.current) {
      frameRef.current = requestAnimationFrame(detectLoop);
    }
  };

  const stopScanning = useCallback(() => {
    scanningRef.current = false;
    setScanning(false);

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startScanning = async () => {
    if (!detectorSupported) {
      showError('Der Browser unterstützt keine QR-Code-Erkennung. Bitte Codes manuell eingeben.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Keine Kamera verfügbar.');
      return;
    }

    if (scanningRef.current) {
      return;
    }

    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8']
      });

      scanningRef.current = true;
      setScanning(true);
      frameRef.current = requestAnimationFrame(detectLoop);
    } catch (error) {
      console.error('Kamera konnte nicht gestartet werden', error);
      setCameraError(error?.message || 'Kamera konnte nicht gestartet werden.');
      stopScanning();
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!codes.length) {
      showError('Bitte mindestens einen QR-Code hinzufügen.');
      return;
    }

    if (!keepUntil) {
      showError('Bitte ein Aufbewahrungsdatum auswählen.');
      return;
    }

    setSubmitting(true);
    try {
      await createStorageBins({
        codes,
        comment,
        keepUntil
      });

      showSuccess(`Erfolgreich ${codes.length} Kisten registriert.`);

      setCodes([]);
      setComment('');
      setKeepUntil('');
      setManualCode('');
      stopScanning();
      await loadBins();
    } catch (error) {
      console.error('Fehler beim Anlegen der Kisten', error);
      const message = error?.response?.data?.error || 'Konnte Kisten nicht anlegen.';
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id) => {
    setProcessingId(id);
    try {
      await completeStorageBin(id);
      showSuccess('Kiste als erledigt markiert.');
      await loadBins();
    } catch (error) {
      console.error('Fehler beim Abschließen der Kiste', error);
      showError(error?.response?.data?.error || 'Kiste konnte nicht abgeschlossen werden.');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingBins = bins.filter((bin) => bin.status === 'pending');
  const completedBins = bins.filter((bin) => bin.status === 'completed');

  const overdueCount = pendingBins.filter((bin) => bin.is_overdue).length;
  const dueSoonCount = pendingBins.filter((bin) => isDueSoon(bin.keep_until)).length;

  const sortedPending = [...pendingBins].sort((a, b) => {
    const aTime = new Date(a.keep_until).getTime();
    const bTime = new Date(b.keep_until).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }
    return aTime - bTime;
  });

  const sortedCompleted = [...completedBins].sort((a, b) => {
    const aTime = new Date(a.completed_at || a.updated_at || 0).getTime();
    const bTime = new Date(b.completed_at || b.updated_at || 0).getTime();
    return bTime - aTime;
  });

  return (
    <div className="min-h-screen bg-slate-950/5 pb-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-72 h-72 bg-blue-500/20 blur-3xl -top-10 -left-10 rounded-full" />
            <div className="absolute w-80 h-80 bg-emerald-500/20 blur-3xl bottom-0 -right-10 rounded-full" />
          </div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-sm font-medium tracking-wide">
                <Scan className="w-4 h-4" />
                Kistenmanagement
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
                Lagerboxen sicher verwalten & prüfen
              </h1>
              <p className="mt-3 text-white/80 max-w-2xl">
                Scanne QR-Codes, plane automatische Erinnerungen und integriere jede Kiste direkt in Kalender und Kanban.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-900 font-semibold">
              <div className="bg-white/90 rounded-2xl px-4 py-3 shadow-lg">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Aktiv</p>
                <p className="mt-2 text-2xl">{pendingBins.length}</p>
              </div>
              <div className="bg-white/90 rounded-2xl px-4 py-3 shadow-lg">
                <p className="text-xs text-rose-500 uppercase tracking-wide">Überfällig</p>
                <p className="mt-2 text-2xl">{overdueCount}</p>
              </div>
              <div className="bg-white/90 rounded-2xl px-4 py-3 shadow-lg">
                <p className="text-xs text-amber-500 uppercase tracking-wide">Bald fällig</p>
                <p className="mt-2 text-2xl">{dueSoonCount}</p>
              </div>
              <div className="bg-white/90 rounded-2xl px-4 py-3 shadow-lg">
                <p className="text-xs text-emerald-500 uppercase tracking-wide">Erledigt</p>
                <p className="mt-2 text-2xl">{completedBins.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <Package className="w-6 h-6 text-blue-600" />
                Neue Kisten registrieren
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                QR-Code scannen oder manuell eingeben – wir übernehmen Planung, Kanban-Aufgabe und Entsorgungs-Erinnerung automatisch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                stopScanning();
                loadBins();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-700 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Aktualisieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-blue-600" />
                      <p className="text-sm font-semibold text-slate-800">
                        QR-Code erfassen
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        detectorSupported ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {detectorSupported ? 'Scanner bereit' : 'Scanner nicht verfügbar'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={startScanning}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                        disabled={scanning}
                      >
                        <QrCode className="w-4 h-4" />
                        Scanner starten
                      </button>
                      <button
                        type="button"
                        onClick={stopScanning}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition"
                      >
                        <StopCircle className="w-4 h-4" />
                        Scanner stoppen
                      </button>
                    </div>
                    {cameraError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                        {cameraError}
                      </div>
                    )}
                    <div className="relative aspect-video bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-700 shadow-inner">
                      <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                      {!scanning && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-sm backdrop-blur-sm bg-slate-900/40">
                          <Camera className="w-8 h-8 mb-2" />
                          <p>Kamera bereit – zum Start auf „Scanner starten“ tippen.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Codes manuell hinzufügen
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="z.B. BOX-12345 oder mehrere Codes mit Leerzeichen"
                      className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                    />
                    <button
                      type="button"
                      onClick={handleManualAdd}
                      className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                    >
                      <ClipboardList className="w-4 h-4" />
                      Hinzufügen
                    </button>
                  </div>
                  {codes.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-slate-700">Erfasste Codes</p>
                        <button
                          type="button"
                          onClick={clearCodes}
                          className="text-xs text-rose-600 hover:text-rose-700"
                        >
                          Liste leeren
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                        {codes.map((code) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold"
                          >
                            {code}
                            <button
                              type="button"
                              onClick={() => removeCode(code)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    Mindestens aufbewahren bis <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={keepUntil}
                    onChange={(e) => setKeepUntil(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Kommentar / Hinweise
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    placeholder="Optional: Lagerort, besondere Hinweise oder Verantwortliche"
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition resize-none"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800 space-y-2">
                  <div className="font-semibold">Automatisierungen</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Kalendereintrag & Erinnerung für den Prüftermin</li>
                    <li>Kanban-Aufgabe mit Frist und Priorität</li>
                    <li>Tägliche Entsorgungs-Erinnerung durch den EntsorgungBot ab Fälligkeit</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Pflichtfelder sind markiert. Bitte sicherstellen, dass alle Codes korrekt sind.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Speichere…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Kisten registrieren
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Offene Kisten
              </h3>
              <p className="text-sm text-slate-500">
                Priorisiert nach nächstem Prüftermin. Überprüfe täglich die roten Markierungen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={`skeleton-${idx}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse space-y-4"
                >
                  <div className="h-4 bg-slate-200 rounded" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                  <div className="h-10 bg-slate-200 rounded" />
                </div>
              ))
            ) : sortedPending.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 col-span-full">
                Aktuell gibt es keine offenen Kisten. Alles abgearbeitet!
              </div>
            ) : (
              sortedPending.map((bin) => {
                const overdue = bin.is_overdue;
                const soon = isDueSoon(bin.keep_until);
                return (
                  <div
                    key={bin.id}
                    className={`rounded-2xl border p-5 space-y-4 bg-white shadow-sm transition ${
                      overdue
                        ? 'border-rose-200 ring-1 ring-rose-100'
                        : soon
                          ? 'border-amber-200 ring-1 ring-amber-100'
                          : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Code</p>
                        <p className="text-lg font-bold text-slate-900 tracking-wide">{bin.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {overdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-700">
                            <AlertTriangle className="w-3 h-3" />
                            Überfällig
                          </span>
                        )}
                        {!overdue && soon && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3" />
                            Bald fällig
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <CalendarDays className="w-4 h-4 text-blue-600" />
                        Fällig: <span className="font-semibold text-slate-800">{formatDate(bin.keep_until)}</span>
                      </div>
                      {bin.task_status && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Package className="w-4 h-4 text-blue-600" />
                          Kanban: <span className="font-semibold text-slate-800">{bin.task_status}</span>
                        </div>
                      )}
                      {bin.calendar?.start && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock className="w-4 h-4 text-blue-600" />
                          Termin: {formatDate(bin.calendar.start)}
                        </div>
                      )}
                      {bin.comment && (
                        <div className="text-slate-600">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Hinweis</p>
                          <p className="font-medium text-slate-800">{bin.comment}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                        Erstellt von: {bin.created_by_name || 'Unbekannt'}
                      </span>
                      {bin.calendar?.start && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          Kalender verknüpft
                        </span>
                      )}
                      {bin.task_status && (
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          Kanban aktiv
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleComplete(bin.id)}
                      disabled={processingId === bin.id}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
                    >
                      {processingId === bin.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Wird abgeschlossen…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Prüfung erledigt
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-900">Abgeschlossene Kisten</h3>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
              Lade Daten…
            </div>
          ) : sortedCompleted.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
              Noch keine abgeschlossenen Kisten dokumentiert.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedCompleted.slice(0, 6).map((bin) => (
                <div key={`completed-${bin.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800">{bin.code}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      abgeschlossen
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500 space-y-1">
                    <p>Fällig: {formatDate(bin.keep_until)}</p>
                    <p>Abgeschlossen: {formatDate(bin.completed_at || bin.updated_at)}</p>
                  </div>
                  {bin.comment && (
                    <p className="mt-2 text-sm text-slate-600">
                      Hinweis: {bin.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default KistenManager;
