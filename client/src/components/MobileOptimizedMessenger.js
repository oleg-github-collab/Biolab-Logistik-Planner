import React, { useState, useEffect } from 'react';
import { ChevronLeft, Send, Plus, Bot, Camera, X, Mic, MicOff } from 'lucide-react';

/**
 * Mobile-optimized messenger interface improvements
 * This component wraps the existing MessengerComplete with mobile-specific enhancements
 */

export const MobileMessengerEnhancements = {
  // Touch gesture handlers
  useTouchGestures: () => {
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const handleTouchStart = (e) => {
      setStartX(e.touches[0].clientX);
      setStartY(e.touches[0].clientY);
      setIsSwiping(true);
    };

    const handleTouchMove = (e, onSwipeLeft, onSwipeRight) => {
      if (!isSwiping) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startX;
      const diffY = currentY - startY;

      // Horizontal swipe detection
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > 50) {
          if (diffX > 0) {
            onSwipeRight?.();
          } else {
            onSwipeLeft?.();
          }
          setIsSwiping(false);
        }
      }
    };

    const handleTouchEnd = () => {
      setIsSwiping(false);
    };

    return {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd
    };
  },

  // Optimized story viewer for mobile
  MobileStoryViewer: ({ story, onClose, onNext, onPrevious }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            onNext?.();
            return 0;
          }
          return prev + 2;
        });
      }, 100);

      return () => clearInterval(timer);
    }, [onNext]);

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800 z-10">
          <div
            className="h-full bg-white transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Story header */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                {story.user_name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="text-white font-semibold">{story.user_name}</p>
                <p className="text-white/70 text-xs">vor {story.time_ago}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Story content */}
        <div className="flex-1 flex items-center justify-center p-4">
          {story.media_type === 'image' ? (
            <img
              src={story.media_url}
              alt="Story"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <video
              src={story.media_url}
              autoPlay
              loop
              muted
              className="max-w-full max-h-full"
            />
          )}
        </div>

        {/* Story caption */}
        {story.caption && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-center">{story.caption}</p>
          </div>
        )}

        {/* Touch areas for navigation */}
        <div className="absolute inset-0 flex">
          <button
            onClick={onPrevious}
            className="w-1/3 h-full focus:outline-none"
            aria-label="Previous story"
          />
          <div className="w-1/3 h-full" />
          <button
            onClick={onNext}
            className="w-1/3 h-full focus:outline-none"
            aria-label="Next story"
          />
        </div>
      </div>
    );
  },

  // Optimized message input for mobile
  MobileMessageInput: ({ onSend, onAttachment, onVoice }) => {
    const [message, setMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const handleSend = () => {
      if (message.trim()) {
        onSend(message);
        setMessage('');
      }
    };

    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t safe-area-bottom">
        <div className="flex items-end gap-2 p-3">
          {/* Actions button */}
          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Plus className={`w-6 h-6 transition-transform ${showActions ? 'rotate-45' : ''}`} />
          </button>

          {/* Quick actions */}
          {showActions && (
            <div className="absolute bottom-full left-2 mb-2 bg-white rounded-2xl shadow-xl border p-2 flex gap-2">
              <button
                onClick={onAttachment}
                className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Camera className="w-5 h-5" />
              </button>
              {/* Add more quick actions as needed */}
            </div>
          )}

          {/* Message input */}
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nachricht eingeben..."
              className="w-full px-4 py-2 bg-gray-100 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
              rows="1"
              style={{ minHeight: '40px' }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>

          {/* Voice or send button */}
          {message.trim() ? (
            <button
              onClick={handleSend}
              className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                setIsRecording(!isRecording);
                onVoice?.(!isRecording);
              }}
              className={`p-2 rounded-full transition-colors ${
                isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-100'
              }`}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>
    );
  },

  // Mobile-optimized conversation list
  MobileConversationList: ({ conversations, selectedId, onSelect, onNewChat }) => {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold">Chats</h2>
          <button
            onClick={onNewChat}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`w-full p-4 flex items-center gap-3 hover:bg-white transition-colors ${
                selectedId === conv.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${
                conv.is_bot ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
              }`}>
                {conv.is_bot ? <Bot className="w-6 h-6" /> : conv.name?.charAt(0) || '?'}
              </div>

              {/* Content */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold truncate">{conv.name}</p>
                  <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                    {conv.time_ago}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">{conv.last_message}</p>
              </div>

              {/* Unread indicator */}
              {conv.unread_count > 0 && (
                <div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {conv.unread_count}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }
};

// CSS additions for mobile optimization
export const mobileStyles = `
  /* Safe area handling for iOS */
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  /* Smooth scrolling */
  .smooth-scroll {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* Disable text selection on buttons */
  button {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Improved tap targets */
  .tap-target {
    min-height: 44px;
    min-width: 44px;
  }

  /* Prevent zoom on input focus */
  input, textarea {
    font-size: 16px !important;
  }

  /* Pull to refresh indicator */
  .pull-to-refresh {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
  }

  /* Message bubble animations */
  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message-animate {
    animation: slideInUp 0.3s ease-out;
  }

  /* Typing indicator */
  @keyframes typing {
    0%, 60%, 100% {
      opacity: 0.3;
    }
    30% {
      opacity: 1;
    }
  }

  .typing-dot {
    animation: typing 1.4s infinite;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  /* Optimized transitions for mobile */
  @media (max-width: 768px) {
    * {
      -webkit-tap-highlight-color: transparent;
    }

    .transition-mobile {
      transition: transform 0.2s ease-out, opacity 0.2s ease-out;
    }

    /* Larger touch targets on mobile */
    button, a {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Optimize scrolling performance */
    .scroll-container {
      -webkit-overflow-scrolling: touch;
      will-change: scroll-position;
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .dark-mode-auto {
      background-color: #1a1a1a;
      color: #ffffff;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default MobileMessengerEnhancements;