import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

let openModalStack = 0;
let storedBodyOverflow = '';

const hasDocument = () => typeof document !== 'undefined';

const lockBodyScroll = () => {
  if (!hasDocument()) return;
  if (openModalStack === 0) {
    storedBodyOverflow = document.body.style.overflow;
  }
  openModalStack += 1;
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-open');
};

const unlockBodyScroll = () => {
  if (!hasDocument()) return;
  openModalStack = Math.max(0, openModalStack - 1);
  if (openModalStack === 0) {
    document.body.style.overflow = storedBodyOverflow || '';
    document.body.classList.remove('modal-open');
    storedBodyOverflow = '';
  }
};

const BaseModal = ({
  isOpen,
  onClose,
  children,
  overlayClassName,
  dialogClassName,
  closeOnOverlayClick,
}) => {
  const [portalElement, setPortalElement] = useState(null);

  useEffect(() => {
    if (!hasDocument()) return undefined;
    const element = document.createElement('div');
    element.className = 'base-modal-portal-root';
    document.body.appendChild(element);
    setPortalElement(element);
    return () => {
      if (document.body.contains(element)) {
        document.body.removeChild(element);
      }
    };
  }, []);

  useEffect(() => {
    if (!portalElement) return undefined;
    if (isOpen) {
      portalElement.classList.add('base-modal-portal-root--active');
    } else {
      portalElement.classList.remove('base-modal-portal-root--active');
    }
    return () => {
      portalElement.classList.remove('base-modal-portal-root--active');
    };
  }, [isOpen, portalElement]);

  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !portalElement) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className={`base-modal-overlay ${overlayClassName}`.trim()}
      role="presentation"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`base-modal-dialog ${dialogClassName}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    portalElement
  );
};

BaseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node.isRequired,
  overlayClassName: PropTypes.string,
  dialogClassName: PropTypes.string,
  closeOnOverlayClick: PropTypes.bool,
};

BaseModal.defaultProps = {
  onClose: () => {},
  overlayClassName: '',
  dialogClassName: '',
  closeOnOverlayClick: true,
};

export default BaseModal;
