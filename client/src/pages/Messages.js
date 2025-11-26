import React, { useEffect } from 'react';
import MessengerUltimate from '../components/MessengerUltimate';

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
      <MessengerUltimate />
    </div>
  );
};

export default Messages;
