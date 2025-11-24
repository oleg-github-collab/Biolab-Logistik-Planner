import React, { useState, useEffect } from 'react';
import DirectMessenger from '../components/DirectMessenger';

const DEFAULT_HEADER_OFFSET = 64;

const Messages = () => {
  const [topOffset, setTopOffset] = useState(DEFAULT_HEADER_OFFSET);

  useEffect(() => {
    const updateTopOffset = () => {
      const header = document.querySelector('.top-nav-mobile');
      if (header) {
        const { height } = header.getBoundingClientRect();
        setTopOffset(Math.ceil(height));
      } else {
        setTopOffset(DEFAULT_HEADER_OFFSET);
      }
    };

    updateTopOffset();
    window.addEventListener('resize', updateTopOffset);
    window.addEventListener('orientationchange', updateTopOffset);
    return () => {
      window.removeEventListener('resize', updateTopOffset);
      window.removeEventListener('orientationchange', updateTopOffset);
    };
  }, []);

  const containerStyle = {
    top: `${topOffset}px`,
    height: `calc(100vh - ${topOffset}px)`,
    zIndex: 1
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 bg-slate-50 px-4 py-4 lg:px-6 overflow-hidden"
      style={containerStyle}
    >
      <div className="h-full w-full">
        <DirectMessenger />
      </div>
    </div>
  );
};

export default Messages;
