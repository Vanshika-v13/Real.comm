import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RoomProvider } from './context/RoomContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import RootRedirect from './components/RootRedirect';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import JoinRoom from './pages/JoinRoom';
import RoomDashboard from './pages/RoomDashboard';
import Settings from './pages/Settings';
import Demo from './pages/Demo';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <RoomProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/demo" element={<Demo />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/join" element={<JoinRoom />} />
                <Route path="/room/:roomId" element={<RoomDashboard />} />
                <Route path="/messages" element={<Dashboard />} />
                <Route path="/channels" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RoomProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
