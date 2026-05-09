import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import SosArmer from './components/Emergency/SosArmer';

function AppRoute({ children, protectedRoute = false }) {
  return protectedRoute ? <ProtectedRoute>{children}</ProtectedRoute> : children;
}

function AppRoutes() {
  const location = useLocation();
  const isLandingRoute = location.pathname === '/';

  if (isLandingRoute) {
    return (
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <ThemeProvider>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<AppRoute><Login /></AppRoute>} />
          <Route path="/signup" element={<AppRoute><Signup /></AppRoute>} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={<AppRoute protectedRoute><Dashboard /></AppRoute>}
          />
          <Route
            path="/create-trip"
            element={<AppRoute protectedRoute><CreateTripPage /></AppRoute>}
          />
          <Route
            path="/trips"
            element={<AppRoute protectedRoute><TripsPage /></AppRoute>}
          />
          <Route
            path="/circle"
            element={<AppRoute protectedRoute><CirclePage /></AppRoute>}
          />
          <Route
            path="/circle/:circleId"
            element={<AppRoute protectedRoute><CirclePage /></AppRoute>}
          />
          <Route
            path="/profile"
            element={<AppRoute protectedRoute><ProfilePage /></AppRoute>}
          />
          <Route
            path="/verify"
            element={<AppRoute protectedRoute><VerificationFlow /></AppRoute>}
          />

          <Route path="*" element={<AppRoute><NotFound /></AppRoute>} />
        </Routes>
      </AnimatePresence>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <PwaUpdatePrompt />
        <SosArmer />
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
