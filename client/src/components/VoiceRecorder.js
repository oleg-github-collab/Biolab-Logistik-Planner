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

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (existingAudioUrl) {
      setAudioUrl(existingAudioUrl);
    }
  }, [existingAudioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl && !existingAudioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, existingAudioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

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
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
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
  };

  const uploadRecording = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
      toast.success('Audio-Anweisung hinzugefügt');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              className="voice-recorder__btn voice-recorder__btn--play flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause' : 'Abspielen'}
            </button>

            {!existingAudioUrl && audioBlob && (
              <button
                type="button"
                onClick={uploadRecording}
                className="voice-recorder__btn voice-recorder__btn--upload flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all shadow-md"
              >
                <Upload className="w-4 h-4" />
                Hinzufügen
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
