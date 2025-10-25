import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';
import Waste from './pages/Waste';
import Schedule from './pages/Schedule';
import FirstSetup from './pages/FirstSetup';
import UserManagement from './pages/UserManagement';
import Admin from './pages/Admin';
import FirstLoginFlow from './components/FirstLoginFlow';
import TaskPoolView from './components/TaskPoolView';
import UserProfilePage from './pages/UserProfilePage';

// Protected Route component with First Login check
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
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
  const { isAuthenticated, user } = useAuth();
  
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
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">System lädt...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen flex flex-col">
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
              path="/task-pool"
              element={
                <ProtectedRoute>
                  <>
                    <Header />
                    <TaskPoolView />
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
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
};

// App wrapper with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
