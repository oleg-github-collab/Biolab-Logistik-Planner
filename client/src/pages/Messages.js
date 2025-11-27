import React, { useEffect } from 'react';
import EnhancedMessenger from '../components/EnhancedMessenger';

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
      <EnhancedMessenger />
    </div>
  );
};

export default Messages;
