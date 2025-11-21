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

  return (
    <div
      className="fixed inset-x-0 bottom-0 bg-slate-50 px-4 py-4 lg:px-6"
      style={{ top: `${topOffset}px` }}
    >
      <DirectMessenger />
    </div>
  );
};

export default Messages;
