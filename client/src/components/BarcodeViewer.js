import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import api from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';
import '../styles/barcodeViewer.css';

const BarcodeViewer = ({ isOpen, onClose, date }) => {
  const [bins, setBins] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

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

  return (
    <div className="barcode-viewer-overlay">
      <div className="barcode-viewer-container">
        {/* Header */}
        <div className="barcode-viewer-header">
          <div className="barcode-viewer-title">
            <h2>Barcodes für {new Date(date).toLocaleDateString('de-DE')}</h2>
            <p className="text-sm text-gray-400">
              {bins.length > 0 ? `${currentIndex + 1} / ${bins.length}` : 'Keine Kisten'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="barcode-viewer-close"
            aria-label="Schließen"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div
          className="barcode-viewer-content"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {loading ? (
            <div className="barcode-viewer-loading">
              <div className="spinner"></div>
              <p>Lade Kisten...</p>
            </div>
          ) : bins.length === 0 ? (
            <div className="barcode-viewer-empty">
              <p>Keine Kisten für dieses Datum gefunden</p>
            </div>
          ) : currentBin ? (
            <div className="barcode-viewer-slide">
              {/* Barcode Image */}
              <div className="barcode-image-container">
                {currentBin.barcode_image_path ? (
                  <img
                    src={currentBin.barcode_image_path}
                    alt={`Barcode für ${currentBin.code}`}
                    className="barcode-image"
                  />
                ) : (
                  <div className="barcode-placeholder">
                    <Upload size={64} className="text-gray-400 mb-4" />
                    <p className="text-gray-400 mb-4">Barcode wird automatisch generiert</p>
                    <p className="text-sm text-gray-500">
                      Bitte warten Sie einen Moment...
                    </p>
                  </div>
                )}
              </div>

              {/* Bin Info */}
              <div className="barcode-info">
                <h3 className="barcode-code">{currentBin.code}</h3>
                {currentBin.comment && (
                  <p className="barcode-comment">{currentBin.comment}</p>
                )}
                <div className="barcode-meta">
                  <span>Aufbewahren bis: {new Date(currentBin.keep_until).toLocaleDateString('de-DE')}</span>
                  {currentBin.created_by_name && (
                    <span>Erstellt von: {currentBin.created_by_name}</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Navigation */}
        {bins.length > 1 && (
          <div className="barcode-viewer-navigation">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="barcode-nav-btn"
              aria-label="Vorheriges"
            >
              <ChevronLeft size={32} />
            </button>

            <div className="barcode-nav-dots">
              {bins.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`barcode-nav-dot ${index === currentIndex ? 'active' : ''}`}
                  aria-label={`Zu Kiste ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={currentIndex === bins.length - 1}
              className="barcode-nav-btn"
              aria-label="Nächstes"
            >
              <ChevronRight size={32} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeViewer;
