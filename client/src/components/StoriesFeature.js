import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  X,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Upload,
  Camera,
  Image as ImageIcon,
  Video,
  Eye,
  Clock,
  Heart,
  MessageCircle,
  Share2,
  MoreVertical,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const StoriesFeature = ({ userId }) => {
  const [stories, setStories] = useState([]);
  const [myStories, setMyStories] = useState([]);
  const [viewingStory, setViewingStory] = useState(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [currentUserStoryIndex, setCurrentUserStoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const progressInterval = useRef(null);
  const autoAdvanceTimeout = useRef(null);

  // Story duration (in seconds)
  const STORY_DURATION = 5;

  useEffect(() => {
    loadStories();
  }, [userId]);

  useEffect(() => {
    if (viewingStory && isPlaying) {
      startProgress();
    } else {
      stopProgress();
    }

    return () => {
      stopProgress();
    };
  }, [viewingStory, currentStoryIndex, isPlaying]);

  const loadStories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/messages/stories');
      const allStories = Array.isArray(res?.data) ? res.data : [];

      // Group stories by user
      const groupedStories = {};
      allStories.forEach(story => {
        const key = story.user_id;
        if (!groupedStories[key]) {
          groupedStories[key] = {
            user_id: story.user_id,
            user_name: story.user_name,
            user_avatar: story.user_avatar,
            stories: []
          };
        }
        groupedStories[key].stories.push(story);
      });

      // Separate own stories
      const ownStories = groupedStories[userId]?.stories || [];
      delete groupedStories[userId];

      setMyStories(ownStories);
      setStories(Object.values(groupedStories));
    } catch (error) {
      console.error('Error loading stories:', error);
      setStories([]);
      setMyStories([]);
    } finally {
      setLoading(false);
    }
  };

  const startProgress = () => {
    stopProgress();
    setProgress(0);

    const startTime = Date.now();
    progressInterval.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newProgress = (elapsed / STORY_DURATION) * 100;

      if (newProgress >= 100) {
        setProgress(100);
        stopProgress();
        handleNextStory();
      } else {
        setProgress(newProgress);
      }
    }, 50);
  };

  const stopProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    if (autoAdvanceTimeout.current) {
      clearTimeout(autoAdvanceTimeout.current);
      autoAdvanceTimeout.current = null;
    }
  };

  const handleNextStory = () => {
    if (!viewingStory) return;

    const currentUserStories = viewingStory.stories;
    if (currentStoryIndex < currentUserStories.length - 1) {
      // Next story from same user
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      // Next user's stories
      const currentUserIndex = stories.findIndex(u => u.user_id === viewingStory.user_id);
      if (currentUserIndex < stories.length - 1) {
        setViewingStory(stories[currentUserIndex + 1]);
        setCurrentStoryIndex(0);
        setCurrentUserStoryIndex(currentUserIndex + 1);
      } else {
        // End of all stories
        closeStoryViewer();
      }
    }
  };

  const handlePrevStory = () => {
    if (!viewingStory) return;

    if (currentStoryIndex > 0) {
      // Previous story from same user
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else {
      // Previous user's stories
      const currentUserIndex = stories.findIndex(u => u.user_id === viewingStory.user_id);
      if (currentUserIndex > 0) {
        const prevUser = stories[currentUserIndex - 1];
        setViewingStory(prevUser);
        setCurrentStoryIndex(prevUser.stories.length - 1);
        setCurrentUserStoryIndex(currentUserIndex - 1);
      }
    }
  };

  const openStoryViewer = async (userStories, startIndex = 0) => {
    setViewingStory(userStories);
    setCurrentStoryIndex(startIndex);
    setIsPlaying(true);

    // Mark story as viewed
    const story = userStories.stories[startIndex];
    if (story) {
      try {
        await api.post(`/messages/stories/${story.id}/view`);
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }
    }
  };

  const closeStoryViewer = () => {
    setViewingStory(null);
    setCurrentStoryIndex(0);
    setCurrentUserStoryIndex(0);
    setProgress(0);
    stopProgress();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Nur Bilder und Videos sind erlaubt');
      return;
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('Datei ist zu groß. Maximum 50MB erlaubt.');
      return;
    }

    setUploadFile(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('caption', uploadCaption);

      await api.post('/messages/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Reset and reload
      setShowCreateModal(false);
      setUploadFile(null);
      setUploadCaption('');
      setPreviewUrl(null);
      await loadStories();

      alert('Story wurde erfolgreich gepostet!');
    } catch (error) {
      console.error('Error uploading story:', error);
      alert('Fehler beim Hochladen der Story');
    } finally {
      setUploading(false);
    }
  };

  const deleteStory = async (storyId) => {
    if (!confirm('Story wirklich löschen?')) return;

    try {
      await api.delete(`/messages/stories/${storyId}`);
      await loadStories();
    } catch (error) {
      console.error('Error deleting story:', error);
      alert('Fehler beim Löschen der Story');
    }
  };

  const formatTime = (date) => {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: de
    });
  };

  // Story Viewer Component
  const renderStoryViewer = () => {
    if (!viewingStory) return null;

    const currentStory = viewingStory.stories[currentStoryIndex];
    if (!currentStory) return null;

    return (
      <div className="fixed inset-0 z-50 bg-black">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 p-2 z-20">
          <div className="flex gap-1">
            {viewingStory.stories.map((_, idx) => (
              <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-200"
                  style={{
                    width: idx < currentStoryIndex ? '100%' :
                           idx === currentStoryIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 p-4 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {viewingStory.user_name?.charAt(0)}
              </div>
              <div>
                <p className="text-white font-semibold">{viewingStory.user_name}</p>
                <p className="text-white/70 text-sm">{formatTime(currentStory.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 text-white hover:bg-white/20 rounded-full transition"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={closeStoryViewer}
                className="p-2 text-white hover:bg-white/20 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation areas */}
        <button
          onClick={handlePrevStory}
          className="absolute left-0 top-0 w-1/3 h-full z-10"
          aria-label="Previous story"
        />
        <button
          onClick={handleNextStory}
          className="absolute right-0 top-0 w-1/3 h-full z-10"
          aria-label="Next story"
        />

        {/* Content */}
        <div className="w-full h-full flex items-center justify-center">
          {currentStory.media_type === 'image' ? (
            <img
              src={currentStory.media_url}
              alt="Story"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              src={currentStory.media_url}
              className="max-w-full max-h-full"
              autoPlay
              muted
              loop
            />
          )}
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-20 left-4 right-4 z-20">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white text-center">{currentStory.caption}</p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <div className="flex items-center justify-center gap-4">
            <button className="p-3 text-white hover:bg-white/20 rounded-full transition">
              <Heart className="w-6 h-6" />
            </button>
            <button className="p-3 text-white hover:bg-white/20 rounded-full transition">
              <MessageCircle className="w-6 h-6" />
            </button>
            <button className="p-3 text-white hover:bg-white/20 rounded-full transition">
              <Share2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Create Story Modal
  const renderCreateModal = () => {
    if (!showCreateModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Story erstellen</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setUploadFile(null);
                  setPreviewUrl(null);
                  setUploadCaption('');
                }}
                className="text-white hover:bg-white/20 rounded-full p-1 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* File upload area */}
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {previewUrl ? (
                <div className="space-y-4">
                  <div className="relative aspect-[9/16] max-h-[400px] mx-auto">
                    {uploadFile?.type.startsWith('image/') ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <video
                        src={previewUrl}
                        className="w-full h-full object-contain rounded-lg"
                        controls
                      />
                    )}
                    <button
                      onClick={() => {
                        setUploadFile(null);
                        setPreviewUrl(null);
                        URL.revokeObjectURL(previewUrl);
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="flex justify-center gap-4 mb-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 bg-purple-100 hover:bg-purple-200 rounded-full transition"
                    >
                      <Upload className="w-8 h-8 text-purple-600" />
                    </button>
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*,video/*';
                        input.capture = 'user';
                        input.onchange = handleFileSelect;
                        input.click();
                      }}
                      className="p-4 bg-pink-100 hover:bg-pink-200 rounded-full transition"
                    >
                      <Camera className="w-8 h-8 text-pink-600" />
                    </button>
                  </div>
                  <p className="text-gray-600">Foto oder Video auswählen</p>
                  <p className="text-sm text-gray-500 mt-1">Max. 50MB</p>
                </div>
              )}
            </div>

            {/* Caption input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung (optional)
              </label>
              <textarea
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Was möchtest du teilen?"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {uploadCaption.length}/200
              </p>
            </div>
          </div>

          <div className="p-4 border-t flex gap-2">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setUploadFile(null);
                setPreviewUrl(null);
                setUploadCaption('');
              }}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition"
            >
              Abbrechen
            </button>
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition"
            >
              {uploading ? 'Hochladen...' : 'Story posten'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Main stories bar component
  return (
    <>
      <div className="bg-white border-b">
        <div className="px-4 py-3">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {/* Add Story Button */}
            <div className="flex-shrink-0">
              <button
                onClick={() => setShowCreateModal(true)}
                className="relative"
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center hover:from-gray-200 hover:to-gray-300 transition">
                  <Plus className="w-8 h-8 text-gray-600" />
                  <span className="text-xs text-gray-600 mt-1">Story</span>
                </div>
                {myStories.length > 0 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {myStories.length}
                  </div>
                )}
              </button>
            </div>

            {/* Own stories */}
            {myStories.length > 0 && (
              <div className="flex-shrink-0">
                <button
                  onClick={() => openStoryViewer({
                    user_id: userId,
                    user_name: 'Meine Story',
                    stories: myStories
                  })}
                  className="relative"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 p-0.5">
                    <div className="w-full h-full rounded-2xl bg-white p-0.5">
                      {myStories[0].media_type === 'image' ? (
                        <img
                          src={myStories[0].media_url}
                          alt="My story"
                          className="w-full h-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                          <Video className="w-8 h-8 text-blue-600" />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-700 font-medium">Meine Story</p>
                </button>
              </div>
            )}

            {/* Other users' stories */}
            {stories.map((userStories) => (
              <div key={userStories.user_id} className="flex-shrink-0">
                <button
                  onClick={() => openStoryViewer(userStories)}
                  className="relative"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 p-0.5">
                    <div className="w-full h-full rounded-2xl bg-white p-0.5">
                      {userStories.stories[0].media_type === 'image' ? (
                        <img
                          src={userStories.stories[0].media_url}
                          alt={userStories.user_name}
                          className="w-full h-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                          <Video className="w-8 h-8 text-purple-600" />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-700 truncate max-w-[80px]">
                    {userStories.user_name}
                  </p>
                  {userStories.stories.length > 1 && (
                    <div className="absolute top-0 right-0 w-5 h-5 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                      {userStories.stories.length}
                    </div>
                  )}
                </button>
              </div>
            ))}

            {/* Loading state */}
            {loading && (
              <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gray-200 animate-pulse" />
            )}

            {/* Empty state */}
            {!loading && stories.length === 0 && myStories.length === 0 && (
              <div className="flex items-center justify-center w-full h-20 text-gray-500">
                <p className="text-sm">Keine Stories verfügbar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {renderStoryViewer()}
      {renderCreateModal()}

      {/* Custom styles */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default StoriesFeature;