import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // You can also log the error to an error reporting service here
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // Implement your error logging service here
    // Example: Sentry, LogRocket, etc.
    console.error('Error logged:', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              {/* Error Icon */}
              <div className="mb-6">
                <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Oops! Etwas ist schief gelaufen
              </h1>

              <p className="text-gray-600 mb-6">
                Die Anwendung ist auf einen unerwarteten Fehler gestoßen.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 text-left">
                  <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                      Fehlerdetails (nur in Entwicklung sichtbar)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="font-mono text-sm text-red-600 break-all">
                          {this.state.error.toString()}
                        </p>
                      </div>
                      {this.state.errorInfo && (
                        <div className="max-h-60 overflow-auto">
                          <pre className="text-xs text-gray-600 bg-white p-3 rounded border border-gray-200">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleReset}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  Nochmal versuchen
                </button>

                <button
                  onClick={this.handleReload}
                  className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  Seite neu laden
                </button>
              </div>

              {/* Error Count (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.errorCount > 1 && (
                <p className="mt-4 text-sm text-gray-500">
                  Fehler ist {this.state.errorCount} Mal aufgetreten
                </p>
              )}
            </div>

            {/* Help Text */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
              <p className="mb-2">Wenn das Problem weiterhin besteht:</p>
              <ul className="list-disc list-inside space-y-1 text-left max-w-md mx-auto">
                <li>Versuchen Sie, die Seite neu zu laden</li>
                <li>Löschen Sie Ihren Browser-Cache</li>
                <li>Kontaktieren Sie den Administrator</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
