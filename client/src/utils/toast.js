import toast from 'react-hot-toast';

/**
 * Utility functions for consistent toast notifications
 */

export const showSuccess = (message) => {
  return toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
};

export const showError = (message, error = null) => {
  const errorMessage = error?.response?.data?.error?.message || error?.message || message;
  return toast.error(errorMessage, {
    duration: 5000,
    position: 'top-right',
  });
};

export const showInfo = (message) => {
  return toast(message, {
    icon: 'ℹ️',
    duration: 3000,
    position: 'top-right',
    style: {
      background: '#3B82F6',
    },
  });
};

export const showWarning = (message) => {
  return toast(message, {
    icon: '⚠️',
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#F59E0B',
    },
  });
};

export const showLoading = (message) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

export const showPromise = (promise, messages) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Lädt...',
      success: messages.success || 'Erfolgreich!',
      error: messages.error || 'Etwas ist schief gelaufen.',
    },
    {
      position: 'top-right',
    }
  );
};

// Custom toast with action button
export const showCustom = (message, action) => {
  return toast.custom(
    (t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">{message}</p>
            </div>
          </div>
        </div>
        {action && (
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => {
                action.onClick();
                toast.dismiss(t.id);
              }}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
    ),
    {
      position: 'top-right',
      duration: 5000,
    }
  );
};

const toastUtils = {
  success: showSuccess,
  error: showError,
  info: showInfo,
  warning: showWarning,
  loading: showLoading,
  dismiss: dismissToast,
  promise: showPromise,
  custom: showCustom
};

export default toastUtils;
