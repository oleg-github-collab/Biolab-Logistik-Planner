import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, Camera } from 'lucide-react';
import { uploadProfileStory } from '../utils/apiEnhanced';
import '../styles/story-composer.css';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const StoryComposer = ({ userId, onClose, onSuccess, showSuccess, showError }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const captionRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const formatFileSize = (size) => {
    if (!size) return 'Unbekannt';
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (size >= 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${size} B`;
  };

  const getFileTypeLabel = (file) => {
    if (!file?.type) return 'Unbekannt';
    return file.type.startsWith('video/') ? 'Video' : 'Bild';
  };

  const handleFileProcessing = (file) => {
    if (!file) return false;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showError?.('Nur Bilder und Videos sind erlaubt');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      showError?.('Datei zu groß (max 50MB)');
      return false;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFileProcessing(event.dataTransfer?.files?.[0]);
  };

  const handleFileSelect = (event) => {
    setIsDragging(false);
    const file = event.target.files?.[0];
    const accepted = handleFileProcessing(file);
    if (!accepted && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError?.('Bitte wähle eine Datei');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      await uploadProfileStory(userId, formData);
      showSuccess?.('Story erfolgreich hochgeladen! 🎉');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error uploading story:', error);
      showError?.(error?.response?.data?.error || 'Fehler beim Hochladen der Story');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePreview = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    setIsDragging(false);
  };

  const handleCameraClick = async () => {
    setCameraError('');
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        setShowCamera(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (error) {
        console.error('Camera error:', error);
        setCameraError('Kamera kann nicht gestartet werden. Bitte Berechtigungen prüfen oder Foto auswählen.');
        // Видалено автоматичний fallback - користувач сам обере "Foto auswählen"
      }
    } else {
      // Якщо getUserMedia не підтримується, показуємо повідомлення
      setCameraError('Browser unterstützt keine Kamera. Bitte wählen Sie ein Foto aus.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleCameraCapture = (event) => {
    setIsDragging(false);
    const file = event.target.files?.[0];
    if (!file) return;
    handleFileProcessing(file);
  };

  const hasPreview = Boolean(preview);
  const dragHint = isDragging ? 'Lass los, um hochzuladen' : 'Oder Datei hierher ziehen';
  const stepLabel = hasPreview ? 'Schritt 2 von 2' : 'Schritt 1 von 2';
  const stepSubtitle = hasPreview ? 'Beschreibung hinzufügen' : 'Medien auswählen';
  const stepProgress = hasPreview ? 100 : 50;

  useEffect(() => {
    if (hasPreview) {
      captionRef.current?.focus({ preventScroll: true });
    }
  }, [hasPreview]);

  return (
    <div className="story-composer-overlay" onClick={onClose}>
      <div className="story-composer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="story-composer-header">
          <div>
            <p className="story-composer-step">{stepLabel}</p>
            <h2>Story erstellen</h2>
            <p className="story-composer-subtitle">{stepSubtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="story-composer-progress" aria-hidden="true">
          <div className="story-composer-progress__bar" style={{ width: `${stepProgress}%` }} />
        </div>

        <div className="story-composer-body">
          {!hasPreview ? (
            <div
              className={`upload-area${isDragging ? ' dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!showCamera) {
                  fileInputRef.current?.click();
                }
              }}
              onKeyDown={(event) => {
                if (showCamera) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              {showCamera && (
                <div className="camera-preview">
                  <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
                  <div className="camera-actions">
                    <button
                      type="button"
                      onClick={() => {
                        if (!videoRef.current || !canvasRef.current) return;
                        const video = videoRef.current;
                        const canvas = canvasRef.current;
                        const width = video.videoWidth || 640;
                        const height = video.videoHeight || 480;
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, width, height);
                        canvas.toBlob((blob) => {
                          if (!blob) return;
                          const file = new File([blob], `story-${Date.now()}.png`, { type: 'image/png' });
                          setSelectedFile(file);
                          const reader = new FileReader();
                          reader.onload = (e) => setPreview(e.target.result);
                          reader.readAsDataURL(file);
                        }, 'image/png');
                        stopCamera();
                      }}
                      className="camera-capture-btn"
                    >
                      Foto aufnehmen
                    </button>
                    <button type="button" onClick={stopCamera} className="camera-close-btn">
                      Abbrechen
                    </button>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}
              <div className="upload-prompt">
                <ImageIcon className="w-16 h-16 text-slate-400 mb-4" />
                <h3>Foto oder Video auswählen</h3>
                <p className="text-sm text-slate-500 mb-2">
                  Maximal 50MB • Bilder oder Videos
                </p>
                <p className="story-composer-drag-hint mb-4">{dragHint}</p>
                <div className="upload-buttons">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCameraClick();
                    }}
                    className="upload-btn camera-btn"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Kamera
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="upload-btn"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    Galerie
                  </button>
                </div>
                {cameraError && (
                  <p className="text-xs text-red-500 mt-2 text-center">{cameraError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="story-composer-grid">
              <div className="story-composer-preview-column">
                <div className="preview-media">
                  {selectedFile?.type.startsWith('image/') ? (
                    <img src={preview} alt="Preview" className="preview-image" />
                  ) : (
                    <video src={preview} controls className="preview-video" />
                  )}
                  <button
                    type="button"
                    onClick={handleRemovePreview}
                    className="remove-preview-btn"
                    aria-label="Entfernen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="story-composer-preview-actions">
                  <div>
                    <p className="story-composer-preview-label">Datei</p>
                    <p className="story-composer-preview-info">
                      {selectedFile?.name || 'Unbekannt'}
                      <span className="story-composer-preview-meta">
                        {getFileTypeLabel(selectedFile)} · {formatFileSize(selectedFile?.size)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="story-composer-link-btn"
                  >
                    Datei ersetzen
                  </button>
                </div>
                <div className="story-composer-preview-hint">
                  <p>Bereit für vertikale Formate und schnelle Ausspielung.</p>
                </div>
              </div>
              <div className="story-composer-editor-column">
                <div className="story-composer-editor-section">
                  <p className="story-composer-editor-label">Beschreibung</p>
                  <div className="caption-input-container">
                    <textarea
                      ref={captionRef}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Schreibe eine Beschreibung... (optional)"
                      className="caption-input"
                      maxLength={200}
                      rows={3}
                    />
                    <div className="caption-counter">
                      {caption.length}/200
                    </div>
                  </div>
                </div>
                <div className="story-composer-editor-section story-composer-editor-notes">
                  <p className="story-composer-editor-label">Tipps & Hinweise</p>
                  <ul>
                    <li>Empfohlene Auflösung: 1080 × 1920 Pixel für maximale Klarheit.</li>
                    <li>Videos unter 60 Sekunden laden schneller und wirken flüssiger.</li>
                    <li>Stories bleiben 24 Stunden sichtbar – nutze deshalb prägnante Aussagen.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture
          onChange={handleCameraCapture}
          className="hidden"
        />

        <div className="story-composer-footer">
          <button
            type="button"
            onClick={onClose}
            className="cancel-btn"
            disabled={uploading}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleUpload}
            className="publish-btn"
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Wird hochgeladen...
              </>
            ) : (
              'Story veröffentlichen'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryComposer;
