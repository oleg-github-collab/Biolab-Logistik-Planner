import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';
import Waste from './pages/Waste';
import FirstSetup from './pages/FirstSetup';
import UserManagement from './pages/UserManagement';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
  const { } = useAuth();

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
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
            path="/"
            element={<Navigate to="/dashboard" replace />}
          />
        </Routes>
      </div>
    </Router>
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
