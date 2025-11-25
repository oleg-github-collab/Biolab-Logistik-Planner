import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX,
  Heart, MessageCircle, Share2, MoreVertical, Eye, Clock,
  Download, Flag, Trash2, Edit, User
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const StoriesViewer = ({
  stories = [],
  currentUserId,
  onClose,
  onLike,
  onComment,
  onShare,
  onDelete,
  onReport,
  initialStoryIndex = 0
}) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const videoRef = useRef(null);
  const progressInterval = useRef(null);
  const storyTimeout = useRef(null);

  const STORY_DURATION = 5000; // 5 seconds per story segment
  const currentStory = stories[currentStoryIndex];
  const segments = currentStory?.segments || [currentStory];
  const currentSegment = segments[currentSegmentIndex];

  // Auto-progress timer
  useEffect(() => {
    if (!isPaused && currentSegment) {
      const duration = currentSegment.type === 'video' ? 15000 : STORY_DURATION;

      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            handleNextSegment();
            return 0;
          }
          return prev + (100 / (duration / 100));
        });
      }, 100);

      return () => {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
      };
    }
  }, [isPaused, currentSegmentIndex, currentStoryIndex]);

  const handleNextSegment = useCallback(() => {
    if (currentSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex(currentSegmentIndex + 1);
      setProgress(0);
    } else {
      handleNextStory();
    }
  }, [currentSegmentIndex, segments.length]);

  const handlePreviousSegment = useCallback(() => {
    if (currentSegmentIndex > 0) {
      setCurrentSegmentIndex(currentSegmentIndex - 1);
      setProgress(0);
    } else {
      handlePreviousStory();
    }
  }, [currentSegmentIndex]);

  const handleNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setCurrentSegmentIndex(0);
      setProgress(0);
    } else {
      onClose?.();
    }
  }, [currentStoryIndex, stories.length, onClose]);

  const handlePreviousStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setCurrentSegmentIndex(0);
      setProgress(0);
    }
  }, [currentStoryIndex]);

  // Touch handlers for swipe navigation
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNextStory();
    }
    if (isRightSwipe) {
      handlePreviousStory();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePreviousSegment();
          break;
        case 'ArrowRight':
          handleNextSegment();
          break;
        case ' ':
          e.preventDefault();
          setIsPaused(!isPaused);
          break;
        case 'Escape':
          onClose?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, handleNextSegment, handlePreviousSegment, onClose]);

  const handleLike = () => {
    onLike?.(currentStory.id);
    // Show like animation
    const likeEl = document.createElement('div');
    likeEl.className = 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 text-8xl animate-ping pointer-events-none z-[2000]';
    likeEl.innerHTML = '❤️';
    document.body.appendChild(likeEl);
    setTimeout(() => likeEl.remove(), 1000);
  };

  const handleComment = () => {
    if (comment.trim()) {
      onComment?.(currentStory.id, comment);
      setComment('');
      setShowComments(false);
    }
  };

  const renderContent = () => {
    if (!currentSegment) return null;

    switch (currentSegment.type) {
      case 'image':
        return (
          <img
            src={currentSegment.url || currentSegment.media_url}
            alt={currentSegment.caption || ''}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.src = '/placeholder-image.png';
            }}
          />
        );

      case 'video':
        return (
          <video
            ref={videoRef}
            src={currentSegment.url || currentSegment.media_url}
            className="w-full h-full object-contain"
            autoPlay
            muted={isMuted}
            loop={false}
            playsInline
          />
        );

      case 'text':
        return (
          <div className="flex items-center justify-center h-full p-8 bg-gradient-to-br from-purple-600 to-pink-600">
            <div className="text-white text-center max-w-md">
              <h2 className="text-3xl font-bold mb-4">{currentSegment.title}</h2>
              <p className="text-lg">{currentSegment.content || currentSegment.caption}</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-white">Unsupported content type</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[1500] flex items-center justify-center">
      <div className="relative w-full h-full max-w-md mx-auto bg-black">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
          {segments.map((_, index) => (
            <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width: index < currentSegmentIndex ? '100%' :
                         index === currentSegmentIndex ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-20 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                {currentStory.user?.name?.[0] || 'U'}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {currentStory.user?.name || 'Unknown User'}
                </p>
                <p className="text-white/70 text-xs">
                  {formatDistanceToNow(new Date(currentStory.created_at || Date.now()), {
                    addSuffix: true,
                    locale: de
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="p-2 text-white hover:bg-white/20 rounded-full transition"
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>

              {currentSegment?.type === 'video' && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 text-white hover:bg-white/20 rounded-full transition"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              )}

              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-white hover:bg-white/20 rounded-full transition relative"
              >
                <MoreVertical className="w-5 h-5" />

                {showActions && (
                  <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl py-2 min-w-[180px]">
                    {currentStory.user_id === currentUserId && (
                      <>
                        <button
                          onClick={() => onDelete?.(currentStory.id)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Löschen
                        </button>
                        <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                          <Edit className="w-4 h-4" />
                          Bearbeiten
                        </button>
                      </>
                    )}
                    <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Herunterladen
                    </button>
                    <button
                      onClick={() => onReport?.(currentStory.id)}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Flag className="w-4 h-4" />
                      Melden
                    </button>
                  </div>
                )}
              </button>

              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className="relative w-full h-full flex items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Navigation areas */}
          <button
            onClick={handlePreviousSegment}
            className="absolute left-0 top-0 w-1/3 h-full z-10"
            aria-label="Previous"
          />
          <button
            onClick={handleNextSegment}
            className="absolute right-0 top-0 w-1/3 h-full z-10"
            aria-label="Next"
          />

          {/* Story content */}
          {renderContent()}

          {/* Caption */}
          {currentSegment?.caption && (
            <div className="absolute bottom-20 left-4 right-4 z-20">
              <p className="text-white text-sm bg-black/50 backdrop-blur rounded-lg px-3 py-2">
                {currentSegment.caption}
              </p>
            </div>
          )}
        </div>

        {/* Actions bar */}
        <div className="absolute bottom-4 left-0 right-0 z-20 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={`p-2 transition ${
                  currentStory.liked ? 'text-red-500' : 'text-white hover:text-red-400'
                }`}
              >
                <Heart className={`w-6 h-6 ${currentStory.liked ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={() => setShowComments(!showComments)}
                className="p-2 text-white hover:text-blue-400 transition"
              >
                <MessageCircle className="w-6 h-6" />
              </button>

              <button
                onClick={() => onShare?.(currentStory)}
                className="p-2 text-white hover:text-green-400 transition"
              >
                <Share2 className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Eye className="w-4 h-4" />
              <span>{currentStory.views || 0}</span>
            </div>
          </div>
        </div>

        {/* Comments input */}
        {showComments && (
          <div className="absolute bottom-16 left-0 right-0 z-30 px-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                placeholder="Kommentar hinzufügen..."
                className="flex-1 bg-transparent text-white placeholder-white/50 outline-none"
              />
              <button
                onClick={handleComment}
                className="text-white hover:text-blue-400 transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Story navigation dots */}
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {stories.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentStoryIndex(index);
                setCurrentSegmentIndex(0);
                setProgress(0);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStoryIndex ? 'bg-white w-8' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action menu backdrop */}
      {showActions && (
        <div
          className="fixed inset-0 z-[1499]"
          onClick={() => setShowActions(false)}
        />
      )}
    </div>
  );
};

export default StoriesViewer;