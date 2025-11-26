import React, { useEffect, useState } from 'react';
import DirectMessenger from '../components/DirectMessenger';
import MessengerRedesigned from '../components/MessengerRedesigned';

const Messages = () => {
  const [useNewDesign, setUseNewDesign] = useState(true); // Default to new design

  // Встановлюємо клас для body
  useEffect(() => {
    document.body.classList.add('messenger-page');
    return () => {
      document.body.classList.remove('messenger-page');
    };
  }, []);

  return (
    <div className="messenger-page-container">
      {useNewDesign ? <MessengerRedesigned /> : <DirectMessenger />}
    </div>
  );
};

export default Messages;
