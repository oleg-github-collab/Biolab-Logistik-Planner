import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import MobileBottomNav from './components/MobileBottomNav';
import CookieConsent from './components/CookieConsent';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';
import Waste from './pages/Waste';
import Schedule from './pages/Schedule';
import FirstSetup from './pages/FirstSetup';
import UserManagement from './pages/UserManagement';
import Admin from './pages/Admin';
import FirstLoginFlow from './components/FirstLoginFlow';
import UserProfilePage from './pages/UserProfilePage';
import Kanban from './pages/Kanban';
import WasteTemplatesAdmin from './pages/WasteTemplatesAdmin';
import KnowledgeBase from './pages/KnowledgeBase';
import KistenManagement from './pages/KistenManagement';
import { WebSocketProvider } from './context/WebSocketContext';

// Protected Route component with First Login check
const ProtectedRoute = ({ children }) => {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated;
  const user = auth?.user;
  const [showFirstLogin, setShowFirstLogin] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && !user.first_login_completed) {
      setShowFirstLogin(true);
    } else {
      setShowFirstLogin(false);
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (showFirstLogin) {
    return (
      <>
        {children}
        <FirstLoginFlow onComplete={() => setShowFirstLogin(false)} />
      </>
    );
  }

  return children;
};

// Admin Route component
const AdminRoute = ({ children }) => {
  const auth = useAuth();
  const isAuthenticated = auth?.isAuthenticated;
  const user = auth?.user;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!['admin', 'superadmin'].includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Main App component
const AppContent = () => {
  const auth = useAuth();
  const { t } = useLocale();
  const loading = auth?.loading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen flex flex-col pb-16 lg:pb-0" id="mobile-app-root">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
                borderRadius: '10px',
                padding: '16px',
                fontSize: '14px',
                fontWeight: '500',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
                style: {
                  background: '#10B981',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
                style: {
                  background: '#EF4444',
                },
              },
              loading: {
                iconTheme: {
                  primary: '#3B82F6',
                  secondary: '#fff',
                },
              },
            }}
          />
          <main className="flex-1 mobile-scroll-container lg:overflow-visible">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/first-setup" element={<FirstSetup />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <Dashboard />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/messages"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <Messages />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/waste"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <Waste />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <Schedule />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kisten"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <KistenManagement />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/task-pool"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <Kanban />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kanban"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <Kanban />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/me"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <UserProfilePage />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/:userId"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <UserProfilePage />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <AdminRoute>
                    <>
                      <Header />
                      <UserManagement />
                    </>
                  </AdminRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <>
                      <Header />
                      <Admin />
                    </>
                  </AdminRoute>
                }
              />
              <Route
                path="/waste-templates"
                element={
                  <AdminRoute>
                    <>
                      <Header />
                      <WasteTemplatesAdmin />
                    </>
                  </AdminRoute>
                }
              />
              <Route
                path="/knowledge-base"
                element={
                  <ProtectedRoute>
                    <>
                      <Header />
                      <KnowledgeBase />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={<Navigate to="/dashboard" replace />}
              />
            </Routes>
          </main>
          <MobileBottomNav />
          <CookieConsent />
        </div>
      </Router>
    </ErrorBoundary>
  );
};

// App wrapper with AuthProvider
function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}

export default App;
// Force rebuild 1763820623
// REBUILD 1763827999
