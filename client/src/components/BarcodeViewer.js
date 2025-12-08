import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import api from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';
import { useMobile } from '../hooks/useMobile';
import '../styles/barcodeViewer.css';

const BarcodeViewer = ({ isOpen, onClose, date }) => {
  const [bins, setBins] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const { isMobile } = useMobile();

  useEffect(() => {
    if (isOpen && date) {
      loadBins();
    }
  }, [isOpen, date]);

  const loadBins = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/kisten/by-date/${date}`);
      setBins(response.data.bins || []);
      setCurrentIndex(0);
    } catch (error) {
      showError('Fehler beim Laden der Kisten');
      console.error('Error loading bins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = useCallback(() => {
    if (currentIndex < bins.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, bins.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') onClose();
  }, [handleNext, handlePrev, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Touch swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    }
    if (isRightSwipe) {
      handlePrev();
    }
  };

  const handleBarcodeUpload = async (binId, file) => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('barcodeImage', file);

      await api.post(`/kisten/${binId}/barcode`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showSuccess('Barcode-Bild hochgeladen');
      await loadBins(); // Reload to get updated image
    } catch (error) {
      showError('Fehler beim Hochladen des Barcode-Bildes');
      console.error('Error uploading barcode:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e, binId) => {
    const file = e.target.files[0];
    if (file) {
      handleBarcodeUpload(binId, file);
    }
  };

  const handleCameraCapture = (e, binId) => {
    const file = e.target.files[0];
    if (file) {
      handleBarcodeUpload(binId, file);
    }
  };

  if (!isOpen) return null;

  const currentBin = bins[currentIndex];
  const containerClass = isMobile
    ? 'relative w-full h-full bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 rounded-none shadow-2xl overflow-hidden border border-gray-200/50 flex flex-col'
    : 'relative w-full max-w-4xl bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 rounded-3xl shadow-2xl overflow-hidden border border-gray-200/50 max-h-[90vh] flex flex-col';

  return (
    <div className={`fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm animate-fadeIn ${isMobile ? 'items-stretch p-0' : 'items-center p-4'}`}>
      <div className={containerClass}>
        {/* Premium Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5 border-b border-white/20">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white drop-shadow-lg flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                QR-Codes für {new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </h2>
              <div className="mt-2 flex items-center gap-3">
                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-sm font-semibold text-white border border-white/30">
                  {bins.length > 0 ? `${currentIndex + 1} / ${bins.length}` : 'Keine Kisten'}
                </span>
                {bins.length > 0 && (
                  <span className="bg-green-500/20 backdrop-blur-md px-3 py-1 rounded-full text-sm font-semibold text-white border border-green-400/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></span>
                    {bins.length} {bins.length === 1 ? 'Kiste' : 'Kisten'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-xl border border-white/40 transition-all hover:scale-110 active:scale-95"
              aria-label="Schließen"
            >
              <X size={24} className="text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto p-5 sm:p-8"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <svg className="absolute inset-0 m-auto w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="mt-4 text-gray-600 font-medium">Lade Kisten...</p>
            </div>
          ) : bins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-700">Keine Kisten gefunden</p>
              <p className="text-sm text-gray-500 mt-2">Für dieses Datum wurden keine Kisten erstellt</p>
            </div>
          ) : currentBin ? (
            <div className="flex flex-col items-center gap-6">
              {/* QR Code Display */}
              <div className="relative w-full max-w-md">
                {currentBin.barcode_image_path ? (
                  <div className="bg-white rounded-2xl shadow-2xl p-8 border-4 border-gray-200">
                    <img
                      src={currentBin.barcode_image_path}
                      alt={`QR-Code für ${currentBin.code}`}
                      className="w-full h-auto"
                    />
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center border-4 border-dashed border-gray-300">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg animate-pulse">
                      <Upload size={40} className="text-white" />
                    </div>
                    <p className="text-gray-700 font-semibold text-center mb-2">QR-Code wird generiert</p>
                    <p className="text-sm text-gray-500 text-center">
                      Bitte warten Sie einen Moment...
                    </p>
                  </div>
                )}
              </div>

              {/* Bin Info Card */}
              <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{currentBin.code}</h3>
                    <p className="text-sm text-gray-500">Kisten-Code</p>
                  </div>
                </div>

                {currentBin.comment && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-sm font-medium text-gray-700">{currentBin.comment}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-xl">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Aufbewahren bis</p>
                      <p className="text-sm font-bold text-gray-900">{new Date(currentBin.keep_until).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  {currentBin.created_by_name && (
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                      <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-600 font-medium">Erstellt von</p>
                        <p className="text-sm font-bold text-gray-900">{currentBin.created_by_name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Premium Navigation */}
        {bins.length > 1 && (
          <div className="relative bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-t border-gray-200/50">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              aria-label="Vorheriges"
            >
              <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Zurück</span>
            </button>

            <div className="flex items-center gap-2">
              {bins.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`transition-all ${
                    index === currentIndex
                      ? 'w-8 h-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-md'
                      : 'w-3 h-3 bg-gray-300 hover:bg-gray-400 rounded-full'
                  }`}
                  aria-label={`Zu Kiste ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={currentIndex === bins.length - 1}
              className="group flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              aria-label="Nächstes"
            >
              <span className="hidden sm:inline">Weiter</span>
              <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeViewer;
