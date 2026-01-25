import React, { useEffect } from 'react';
import DirectMessenger from '../components/DirectMessenger';

const Messages = () => {
  // Встановлюємо клас для body
  useEffect(() => {
    document.body.classList.add('messenger-page');
    return () => {
      document.body.classList.remove('messenger-page');
    };
  }, []);

  return (
    <div
      className="messenger-page-container"
      style={{
        height: 'calc(100vh - 64px)',
        maxHeight: 'calc(100vh - 64px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <DirectMessenger />
    </div>
  );
};

export default Messages;
