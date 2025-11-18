import React from 'react';
import '../styles/footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p className="footer-credit">
          Made by <span className="footer-author">Oleh Kaminskyi</span>
        </p>
        <p className="footer-copy">
          © {currentYear} Biolab Logistik Planner
        </p>
      </div>
    </footer>
  );
};

export default Footer;
