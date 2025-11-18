import React, { useState, useEffect } from 'react';
import { Cookie, X, Settings } from 'lucide-react';
import '../styles/cookie-consent.css';

const CookieConsent = () => {
  const [show, setShow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Always enabled
    analytics: false,
    marketing: false,
    functional: false
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Delay showing to avoid flash on page load
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(allAccepted));
    setShow(false);
  };

  const handleAcceptNecessary = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(necessaryOnly));
    setShow(false);
  };

  const handleSavePreferences = () => {
    const savedPreferences = {
      ...preferences,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('cookieConsent', JSON.stringify(savedPreferences));
    setShow(false);
    setShowSettings(false);
  };

  const togglePreference = (key) => {
    if (key === 'necessary') return; // Can't disable necessary cookies
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (!show) return null;

  return (
    <>
      {/* Cookie Banner */}
      <div className="cookie-consent-overlay">
        <div className="cookie-consent-banner">
          <div className="cookie-consent-header">
            <div className="cookie-icon-wrapper">
              <Cookie className="cookie-icon" />
            </div>
            <button
              onClick={handleAcceptNecessary}
              className="cookie-close-btn"
              aria-label="Ablehnen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="cookie-consent-body">
            <h2>Wir verwenden Cookies 🍪</h2>
            <p>
              Wir verwenden Cookies und ähnliche Technologien, um Ihre Erfahrung zu verbessern,
              unsere Dienste zu analysieren und personalisierte Inhalte anzubieten. Sie können
              wählen, welche Cookies Sie akzeptieren möchten.
            </p>

            <div className="cookie-links">
              <button
                onClick={() => setShowSettings(true)}
                className="cookie-link-btn"
              >
                <Settings className="w-4 h-4" />
                Cookie-Einstellungen
              </button>
              <a href="/datenschutz" className="cookie-link">
                Datenschutzerklärung
              </a>
              <a href="/impressum" className="cookie-link">
                Impressum
              </a>
            </div>
          </div>

          <div className="cookie-consent-footer">
            <button
              onClick={handleAcceptNecessary}
              className="cookie-btn cookie-btn-secondary"
            >
              Nur Notwendige
            </button>
            <button
              onClick={handleAcceptAll}
              className="cookie-btn cookie-btn-primary"
            >
              Alle akzeptieren
            </button>
          </div>
        </div>
      </div>

      {/* Cookie Settings Modal */}
      {showSettings && (
        <div className="cookie-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="cookie-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cookie-settings-header">
              <h2>Cookie-Einstellungen</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="cookie-close-btn"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="cookie-settings-body">
              <p className="cookie-settings-intro">
                Wählen Sie, welche Cookies Sie akzeptieren möchten. Sie können Ihre Einstellungen
                jederzeit ändern.
              </p>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <div>
                    <h3>Notwendige Cookies</h3>
                    <p>Erforderlich für die Grundfunktionen der Website</p>
                  </div>
                  <div className="cookie-toggle disabled">
                    <span>Immer aktiv</span>
                  </div>
                </div>
              </div>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <div>
                    <h3>Analytische Cookies</h3>
                    <p>Helfen uns zu verstehen, wie Sie unsere Website nutzen</p>
                  </div>
                  <label className="cookie-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={() => togglePreference('analytics')}
                    />
                    <span className="cookie-toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <div>
                    <h3>Marketing Cookies</h3>
                    <p>Werden verwendet, um Ihnen relevante Werbung anzuzeigen</p>
                  </div>
                  <label className="cookie-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={() => togglePreference('marketing')}
                    />
                    <span className="cookie-toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div className="cookie-category">
                <div className="cookie-category-header">
                  <div>
                    <h3>Funktionale Cookies</h3>
                    <p>Ermöglichen erweiterte Funktionen und Personalisierung</p>
                  </div>
                  <label className="cookie-toggle">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={() => togglePreference('functional')}
                    />
                    <span className="cookie-toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div className="cookie-settings-footer">
              <button
                onClick={() => setShowSettings(false)}
                className="cookie-btn cookie-btn-secondary"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSavePreferences}
                className="cookie-btn cookie-btn-primary"
              >
                Einstellungen speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieConsent;
