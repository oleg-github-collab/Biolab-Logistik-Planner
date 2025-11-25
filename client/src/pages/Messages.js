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
    <div className="messenger-page-container">
      <DirectMessenger />
    </div>
  );
};

export default Messages;
