import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/calendar.css';
import App from './App';

// CRITICAL: Setup global date format protection BEFORE any components load
import { setupDateProtection } from './utils/setupDateProtection';
setupDateProtection();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);