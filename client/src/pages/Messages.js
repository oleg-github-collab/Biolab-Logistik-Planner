import React, { useEffect } from 'react';
import MessengerPowerful from '../components/MessengerPowerful';

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
      <MessengerPowerful />
    </div>
  );
};

export default Messages;
