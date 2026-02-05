import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

const VoiceRecorder = ({ onRecordingComplete, existingAudioUrl = null }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(existingAudioUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasUploaded, setHasUploaded] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingFinalizedRef = useRef(false);
  const recordingStopTimeoutRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const recordingMetaRef = useRef({ mime: 'audio/webm', extension: 'webm' });

  useEffect(() => {
    if (existingAudioUrl) {
      setAudioUrl(existingAudioUrl);
    }
  }, [existingAudioUrl]);

  useEffect(() => {
    setHasUploaded(false);
  }, [audioBlob, audioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingStopTimeoutRef.current) clearTimeout(recordingStopTimeoutRef.current);
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
      }
      if (audioUrl && !existingAudioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, existingAudioUrl]);

  const resolveMimeType = () => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return null;
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4'
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  };

  const finalizeRecording = ({ silent } = {}) => {
    if (recordingFinalizedRef.current) return;
    recordingFinalizedRef.current = true;
    if (recordingStopTimeoutRef.current) {
      clearTimeout(recordingStopTimeoutRef.current);
      recordingStopTimeoutRef.current = null;
    }

    if (audioChunksRef.current.length === 0) {
      if (!silent) {
        toast.error('Aufnahme war leer');
      }
    } else {
      const { mime, extension } = recordingMetaRef.current || { mime: 'audio/webm', extension: 'webm' };
      const blob = new Blob(audioChunksRef.current, { type: mime || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioUrl(url);
    }

    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  const startRecording = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        toast.error('Audioaufnahme wird von diesem Gerät nicht unterstützt');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = resolveMimeType();
      const resolvedMime = mimeType || 'audio/webm';
      const extension = resolvedMime.includes('ogg')
        ? 'ogg'
        : resolvedMime.includes('mp4')
          ? 'm4a'
          : 'webm';
      recordingMetaRef.current = { mime: resolvedMime, extension };

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingFinalizedRef.current = false;
      recordingStartedAtRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        finalizeRecording();
      };

      mediaRecorder.onerror = (event) => {
        console.error('Recording error:', event?.error || event);
        finalizeRecording({ silent: true });
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Mikrofon konnte nicht aktiviert werden');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.requestData?.();
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('Error stopping recorder:', error);
        finalizeRecording({ silent: true });
      }
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recordingStopTimeoutRef.current) {
        clearTimeout(recordingStopTimeoutRef.current);
      }
      recordingStopTimeoutRef.current = setTimeout(() => {
        if (!recordingFinalizedRef.current) {
          finalizeRecording({ silent: true });
        }
      }, 1200);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const deleteRecording = () => {
    if (audioUrl && !existingAudioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setHasUploaded(false);
  };

  const uploadRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
      toast.success('Audio-Anweisung hinzugefügt');
      setHasUploaded(true);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`voice-recorder bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200${isRecording ? ' is-recording' : ''}${isPlaying ? ' is-playing' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Mic className="w-4 h-4 text-blue-600" />
          Audio-Anweisung
        </label>
        {(isRecording || recordingTime > 0) && (
          <span className="text-sm font-mono text-blue-600 font-semibold">
            {formatTime(recordingTime)}
          </span>
        )}
      </div>

      {!audioUrl && !isRecording && (
        <button
          type="button"
          onClick={startRecording}
          className="voice-recorder__btn voice-recorder__btn--record w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg"
        >
          <Mic className="w-5 h-5" />
          Aufnahme starten
        </button>
      )}

      {isRecording && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={pauseRecording}
              className="voice-recorder__btn voice-recorder__btn--pause flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition-all shadow-md"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              {isPaused ? 'Fortsetzen' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="voice-recorder__btn voice-recorder__btn--stop flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all shadow-md"
            >
              <Square className="w-5 h-5" />
              Stopp
            </button>
          </div>
          <div className="h-2 bg-white/50 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-pink-500 animate-pulse" />
          </div>
        </div>
      )}

      {audioUrl && !isRecording && (
        <div className="space-y-3">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full"
            controls
          />
          <p className="text-xs text-slate-500">
            {existingAudioUrl ? 'Audio vorhanden' : 'Aufnahme bereit · Zum Hinzufügen'}
          </p>

          <div className="voice-recorder__actions">
            <button
              type="button"
              onClick={togglePlayback}
              className="voice-recorder__btn voice-recorder__btn--play flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause' : 'Abspielen'}
            </button>

            {audioBlob && (
              <button
                type="button"
                onClick={uploadRecording}
                className="voice-recorder__btn voice-recorder__btn--upload flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all shadow-md"
                disabled={hasUploaded}
              >
                <Upload className="w-4 h-4" />
                {hasUploaded ? 'Hinzugefügt' : 'Hinzufügen'}
              </button>
            )}

            <button
              type="button"
              onClick={deleteRecording}
              className="voice-recorder__btn voice-recorder__btn--delete flex items-center justify-center p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
