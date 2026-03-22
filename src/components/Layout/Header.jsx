import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      toast.success('Logged out');
    } catch {
      toast.error('Logout failed');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="container-max flex items-center justify-between h-16">
        {/* Logo */}
        <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <span className="text-xl font-bold text-blue-600">SafeCircles</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="text-gray-600 hover:text-blue-600 font-medium text-sm">
                Dashboard
              </Link>
              <Link to="/create-trip" className="text-gray-600 hover:text-blue-600 font-medium text-sm">
                New Trip
              </Link>
              <Link to="/profile" className="text-gray-600 hover:text-blue-600 font-medium text-sm">
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium text-sm">
                Login
              </Link>
              <Link to="/signup" className="btn-primary text-sm px-4 py-2">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
