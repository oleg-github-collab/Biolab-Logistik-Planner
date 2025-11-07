import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

const PLAYBACK_SPEEDS = [1, 1.5, 2];

const VoiceMessagePlayer = ({ audioUrl, duration: providedDuration, className = '' }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(providedDuration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState([]);

  useEffect(() => {
    // Generate random waveform data for visualization
    const bars = 40;
    const data = Array.from({ length: bars }, () => Math.random() * 0.7 + 0.3);
    setWaveformData(data);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200 ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Waveform Visualization */}
      <div
        onClick={handleSeek}
        className="relative h-16 mb-4 cursor-pointer group"
        role="progressbar"
        aria-label="Audiowiedergabe"
        aria-valuenow={progressPercentage}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div className="absolute inset-0 flex items-center justify-between gap-0.5">
          {waveformData.map((height, index) => {
            const barProgress = (index / waveformData.length) * 100;
            const isPassed = barProgress <= progressPercentage;

            return (
              <div
                key={index}
                className="flex-1 flex items-center justify-center transition-all duration-150"
              >
                <div
                  className={`w-full rounded-full transition-all ${
                    isPassed
                      ? 'bg-blue-600 group-hover:bg-blue-700'
                      : 'bg-blue-200 group-hover:bg-blue-300'
                  }`}
                  style={{ height: `${height * 100}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Progress Overlay */}
        <div
          className="absolute top-0 left-0 h-full bg-blue-600/10 pointer-events-none transition-all"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition shadow-lg shadow-blue-600/30 flex-shrink-0"
          aria-label={isPlaying ? 'Pause' : 'Abspielen'}
        >
          {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />}
        </button>

        {/* Time Display */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-slate-700">
            <span>{formatTime(currentTime)}</span>
            <span className="text-slate-500">/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Progress Bar (Mobile Alternative) */}
          <div className="mt-1 h-1 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Playback Speed */}
        <button
          onClick={cyclePlaybackSpeed}
          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white border border-blue-200 text-blue-700 font-semibold text-xs sm:text-sm hover:bg-blue-50 hover:border-blue-300 transition flex-shrink-0"
          aria-label={`Wiedergabegeschwindigkeit: ${playbackSpeed}x`}
        >
          {playbackSpeed}x
        </button>

        {/* Volume Control */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-lg bg-white border border-blue-200 text-blue-700 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition"
            aria-label={isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-16 accent-blue-600"
            aria-label="Lautstärke"
          />
        </div>

        {/* Mobile Volume Toggle */}
        <button
          onClick={toggleMute}
          className="sm:hidden w-10 h-10 rounded-lg bg-white border border-blue-200 text-blue-700 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition flex-shrink-0"
          aria-label={isMuted ? 'Stummschaltung aufheben' : 'Stummschalten'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
