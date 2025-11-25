import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronLeft, ChevronRight, Play, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import StoriesViewer from './StoriesViewer';

const StoriesCarousel = ({
  stories = [],
  currentUserId,
  onAddStory,
  onStoryClick,
  onLike,
  onComment,
  onShare,
  onDelete,
  className = ''
}) => {
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const carouselRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Group stories by user
  const groupedStories = stories.reduce((acc, story) => {
    const userId = story.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        user: story.user,
        stories: [],
        lastUpdated: story.created_at,
        hasUnread: !story.viewed_by?.includes(currentUserId)
      };
    }
    acc[userId].stories.push(story);
    if (new Date(story.created_at) > new Date(acc[userId].lastUpdated)) {
      acc[userId].lastUpdated = story.created_at;
    }
    return acc;
  }, {});

  const storyGroups = Object.values(groupedStories).sort(
    (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)
  );

  // Check if carousel is scrollable
  useEffect(() => {
    const checkScrollable = () => {
      if (scrollContainerRef.current) {
        const { scrollWidth, clientWidth } = scrollContainerRef.current;
        setIsScrollable(scrollWidth > clientWidth);
      }
    };

    checkScrollable();
    window.addEventListener('resize', checkScrollable);
    return () => window.removeEventListener('resize', checkScrollable);
  }, [storyGroups]);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      const currentScroll = scrollContainerRef.current.scrollLeft;
      scrollContainerRef.current.scrollTo({
        left: direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleStoryClick = (groupIndex) => {
    setSelectedStoryIndex(groupIndex);
    onStoryClick?.(storyGroups[groupIndex].stories);
  };

  const handleCloseViewer = () => {
    setSelectedStoryIndex(null);
  };

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-4 md:px-0">
          <h3 className="text-lg font-semibold text-slate-900">Stories</h3>
          <div className="flex items-center gap-2">
            {isScrollable && (
              <>
                <button
                  onClick={() => scroll('left')}
                  className="p-1.5 bg-white rounded-full shadow-md hover:shadow-lg transition hidden md:block"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  className="p-1.5 bg-white rounded-full shadow-md hover:shadow-lg transition hidden md:block"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stories Carousel */}
        <div className="relative" ref={carouselRef}>
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-4 md:px-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Add Story Button */}
            <button
              onClick={onAddStory}
              className="flex-shrink-0 group"
            >
              <div className="relative">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-xs text-center mt-2 text-slate-600">Deine Story</p>
            </button>

            {/* Story Groups */}
            {storyGroups.map((group, index) => (
              <button
                key={group.user.id}
                onClick={() => handleStoryClick(index)}
                className="flex-shrink-0 group"
              >
                <div className="relative">
                  {/* Ring for unread stories */}
                  <div className={`absolute inset-0 rounded-2xl ${
                    group.hasUnread
                      ? 'bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500'
                      : 'bg-gradient-to-br from-slate-300 to-slate-400'
                  } p-[2px]`}>
                    <div className="w-full h-full bg-white rounded-2xl" />
                  </div>

                  {/* User Avatar */}
                  <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden group-hover:scale-105 transition-transform">
                    {group.stories[0].media_url ? (
                      <img
                        src={group.stories[0].media_url}
                        alt={group.user.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(group.user.name)}&background=random`;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold text-lg md:text-xl">
                        {group.user.name?.[0]?.toUpperCase()}
                      </div>
                    )}

                    {/* Live indicator if story is very recent */}
                    {new Date() - new Date(group.lastUpdated) < 3600000 && (
                      <div className="absolute top-1 right-1 flex items-center gap-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    )}

                    {/* Story count badge */}
                    {group.stories.length > 1 && (
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {group.stories.length}
                      </div>
                    )}
                  </div>
                </div>

                {/* User name and time */}
                <div className="mt-2">
                  <p className="text-xs text-center text-slate-700 font-medium truncate max-w-[64px] md:max-w-[80px]">
                    {group.user.name}
                  </p>
                  <p className="text-[10px] text-center text-slate-500">
                    {formatDistanceToNow(new Date(group.lastUpdated), {
                      addSuffix: false,
                      locale: de
                    })}
                  </p>
                </div>
              </button>
            ))}

            {/* Empty state */}
            {storyGroups.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-8 text-slate-500 text-sm">
                Noch keine Stories vorhanden
              </div>
            )}
          </div>

          {/* Gradient overlays for scroll indication */}
          {isScrollable && (
            <>
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none md:hidden" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden" />
            </>
          )}
        </div>
      </div>

      {/* Stories Viewer Modal */}
      {selectedStoryIndex !== null && (
        <StoriesViewer
          stories={storyGroups[selectedStoryIndex].stories}
          currentUserId={currentUserId}
          onClose={handleCloseViewer}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
          onDelete={onDelete}
          initialStoryIndex={0}
        />
      )}
    </>
  );
};

export default StoriesCarousel;