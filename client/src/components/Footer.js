import React from 'react';
import '../styles/footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        <p className="footer-credit">
          Made with <span className="footer-heart">❤️</span> by{' '}
          <a
            href="https://github.com/oleg-github-collab"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Oleh Kaminskyi
          </a>
        </p>
        <p className="footer-copy">
          © {currentYear} Biolab Logistik Planner
        </p>
      </div>
    </footer>
  );
};

export default Footer;
