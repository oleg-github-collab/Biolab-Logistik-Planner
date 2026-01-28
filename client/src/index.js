import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/calendar.css';
import './styles/desktop-header.css';
import './styles/mobile-app-style.css';
import App from './App';

// Version control and cache busting
import './version';

// CRITICAL: Setup global date format protection BEFORE any components load
import { setupDateProtection } from './utils/setupDateProtection';
setupDateProtection();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);/* FORCE REBUILD 1763822726 */
