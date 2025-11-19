import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, Camera } from 'lucide-react';
import { uploadProfileStory } from '../utils/apiEnhanced';
import '../styles/story-composer.css';

const StoryComposer = ({ userId, onClose, onSuccess, showSuccess, showError }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showError?.('Nur Bilder und Videos sind erlaubt');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showError?.('Datei zu groß (max 50MB)');
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError?.('Bitte wähle eine Datei');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('storyMedia', selectedFile);
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
        setCameraError('Kamera kann nicht gestartet werden. Bitte Berechtigungen prüfen.');
        if (cameraInputRef.current) {
          cameraInputRef.current.click();
        }
      }
    } else if (cameraInputRef.current) {
      cameraInputRef.current.click();
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
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showError?.('Nur Bilder und Videos sind erlaubt');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showError?.('Datei zu groß (max 50MB)');
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="story-composer-overlay" onClick={onClose}>
      <div className="story-composer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="story-composer-header">
          <h2>Story erstellen</h2>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="story-composer-body">
          {!preview ? (
            <div className="upload-area">
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
                <p className="text-sm text-slate-500 mb-4">
                  Maximal 50MB • Bilder oder Videos
                </p>
                <div className="upload-buttons">
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    className="upload-btn camera-btn"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
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
            </div>
          ) : (
            <div className="preview-container">
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

              <div className="caption-input-container">
                <textarea
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
          )}
        </div>

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
