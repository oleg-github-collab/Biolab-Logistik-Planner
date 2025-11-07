import React, { useState, useRef } from 'react';
import { Upload, File, X, Image, FileText, FileAudio, FileVideo, CheckCircle2 } from 'lucide-react';

/**
 * FileDropZone Component
 * Drag & drop file upload with preview
 * @param {Function} onFilesSelected - Callback when files are selected
 * @param {Array} acceptedTypes - Array of accepted MIME types
 * @param {Number} maxSize - Max file size in MB
 * @param {Boolean} multiple - Allow multiple files
 */
const FileDropZone = ({
  onFilesSelected,
  acceptedTypes = [],
  maxSize = 10,
  multiple = true,
  compact = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    // Check file size
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `Datei zu groß (max ${maxSize}MB)`;
    }

    // Check file type
    if (acceptedTypes.length > 0) {
      const isAccepted = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          const category = type.split('/')[0];
          return file.type.startsWith(category + '/');
        }
        return file.type === type;
      });

      if (!isAccepted) {
        return 'Dateityp nicht unterstützt';
      }
    }

    return null;
  };

  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    const validFiles = [];
    let hasError = false;

    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        setError(error);
        hasError = true;
      } else {
        validFiles.push(file);
      }
    });

    if (!hasError && validFiles.length > 0) {
      setError('');
      setSelectedFiles(prev => multiple ? [...prev, ...validFiles] : validFiles);
      if (onFilesSelected) {
        onFilesSelected(multiple ? [...selectedFiles, ...validFiles] : validFiles);
      }
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleRemoveFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    if (onFilesSelected) {
      onFilesSelected(newFiles);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    } else if (file.type.startsWith('video/')) {
      return <FileVideo className="w-5 h-5" />;
    } else if (file.type.startsWith('audio/')) {
      return <FileAudio className="w-5 h-5" />;
    } else {
      return <FileText className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFilePreview = (file) => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-4 transition cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Upload className={`w-5 h-5 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">
                Dateien hierher ziehen oder <span className="text-blue-600">durchsuchen</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Max {maxSize}MB {acceptedTypes.length > 0 && `• ${acceptedTypes.join(', ')}`}
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            accept={acceptedTypes.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="text-blue-600">
                  {getFileIcon(file)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <button
                  onClick={() => handleRemoveFile(index)}
                  className="p-1 hover:bg-slate-200 rounded transition"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 transition cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isDragging ? 'bg-blue-100' : 'bg-slate-100'
          }`}>
            <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
          </div>

          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {isDragging ? 'Dateien hier ablegen' : 'Dateien hochladen'}
          </h3>

          <p className="text-sm text-slate-600 mb-1">
            Dateien hierher ziehen oder <span className="text-blue-600 font-semibold">klicken zum Durchsuchen</span>
          </p>

          <p className="text-xs text-slate-500">
            Max {maxSize}MB pro Datei
            {acceptedTypes.length > 0 && ` • ${acceptedTypes.join(', ')}`}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2">
            <File className="w-4 h-4" />
            Ausgewählte Dateien ({selectedFiles.length})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedFiles.map((file, index) => {
              const preview = getFilePreview(file);
              return (
                <div
                  key={index}
                  className="group relative bg-white border-2 border-slate-200 rounded-xl p-3 hover:shadow-md hover:border-blue-300 transition"
                >
                  {preview && (
                    <div className="mb-3 rounded-lg overflow-hidden bg-slate-100">
                      <img
                        src={preview}
                        alt={file.name}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {!preview && (
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate mb-1">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(index);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Entfernen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 drop-shadow" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDropZone;
