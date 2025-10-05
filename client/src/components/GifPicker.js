import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { showError } from '../utils/toast';

const TENOR_API_KEY = 'AIzaSyDCTq7o-lL1b3gC5ZEYbQNgN9hx7DqR0iE';
const TENOR_API_BASE = 'https://tenor.googleapis.com/v2';

const POPULAR_CATEGORIES = [
  { name: 'Happy', emoji: '😊' },
  { name: 'Sad', emoji: '😢' },
  { name: 'Love', emoji: '❤️' },
  { name: 'Funny', emoji: '😂' },
  { name: 'Celebrate', emoji: '🎉' },
  { name: 'Thumbs Up', emoji: '👍' },
  { name: 'Dance', emoji: '💃' },
  { name: 'Wow', emoji: '😮' }
];

const GifPicker = ({ onSelectGif, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [hoveredGif, setHoveredGif] = useState(null);

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim()) {
        searchGifs(searchTerm);
      } else if (!selectedCategory) {
        loadTrendingGifs();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Load trending GIFs on mount
  useEffect(() => {
    loadTrendingGifs();
  }, []);

  const loadTrendingGifs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${TENOR_API_BASE}/featured?key=${TENOR_API_KEY}&client_key=biolab_messenger&limit=20&media_filter=gif`
      );

      if (!response.ok) {
        throw new Error('Failed to load trending GIFs');
      }

      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Error loading trending GIFs:', error);
      showError('Fehler beim Laden der Trending GIFs');
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${TENOR_API_BASE}/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=biolab_messenger&limit=20&media_filter=gif`
      );

      if (!response.ok) {
        throw new Error('Failed to search GIFs');
      }

      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error('Error searching GIFs:', error);
      showError('Fehler beim Suchen der GIFs');
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setSearchTerm(category.name);
    searchGifs(category.name);
  };

  const handleGifSelect = (gif) => {
    // Get the GIF URL from the media formats
    const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url;

    if (gifUrl) {
      onSelectGif({
        url: gifUrl,
        preview: gif.media_formats?.tinygif?.url || gifUrl,
        title: gif.content_description || 'GIF'
      });
      onClose();
    } else {
      showError('GIF URL nicht gefunden');
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setSelectedCategory(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl transform transition-all">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-pink-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <span className="mr-2">GIF Picker</span>
              <span className="text-sm font-normal opacity-90">powered by Tenor</span>
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-1.5 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Suche nach GIFs..."
              className="w-full border-0 rounded-lg px-4 py-2 pl-10 focus:ring-2 focus:ring-purple-300 text-gray-900"
              autoFocus
            />
            <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory(null);
                  loadTrendingGifs();
                }}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mt-3">
            {POPULAR_CATEGORIES.map((category) => (
              <button
                key={category.name}
                onClick={() => handleCategoryClick(category)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory?.name === category.name
                    ? 'bg-white text-purple-600 shadow-md'
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
                }`}
              >
                <span className="mr-1">{category.emoji}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* GIF Grid */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(80vh - 180px)' }}>
          {loading ? (
            <LoadingSpinner variant="dots" size="md" text="Lade GIFs..." />
          ) : gifs.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium">Keine GIFs gefunden</p>
              <p className="text-sm text-gray-400 mt-1">Versuche eine andere Suche</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {gifs.map((gif) => {
                const previewUrl = gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url;
                const fullUrl = gif.media_formats?.gif?.url;

                return (
                  <div
                    key={gif.id}
                    onClick={() => handleGifSelect(gif)}
                    onMouseEnter={() => setHoveredGif(gif.id)}
                    onMouseLeave={() => setHoveredGif(null)}
                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-gray-100"
                  >
                    <img
                      src={hoveredGif === gif.id ? fullUrl : previewUrl}
                      alt={gif.content_description || 'GIF'}
                      className="w-full h-full object-cover transition-all group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <a
              href="https://tenor.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              Tenor
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default GifPicker;
