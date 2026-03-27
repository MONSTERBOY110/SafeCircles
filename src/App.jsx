import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import CreateTripPage from './pages/CreateTripPage';
import CirclePage from './pages/CirclePage';
import ProfilePage from './pages/ProfilePage';
import TripsPage from './pages/TripsPage';
import NotFound from './pages/NotFound';
import VerificationFlow from './components/Verification/VerificationFlow';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />
          <Route
            path="/create-trip"
            element={<ProtectedRoute><CreateTripPage /></ProtectedRoute>}
          />
          <Route
            path="/trips"
            element={<ProtectedRoute><TripsPage /></ProtectedRoute>}
          />
          <Route
            path="/circle/:circleId"
            element={<ProtectedRoute><CirclePage /></ProtectedRoute>}
          />
          <Route
            path="/profile"
            element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
          />
          <Route
            path="/verify"
            element={<ProtectedRoute><VerificationFlow /></ProtectedRoute>}
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
