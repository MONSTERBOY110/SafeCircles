import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navigation() {
  const { logout } = useAuth();
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

  const links = [
    { 
      to: '/dashboard', 
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
    },
    { 
      to: '/circle', 
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 19H9a6 6 0 016-6h.01M3 20h18a1 1 0 001-1V8a1 1 0 00-1-1h-18a1 1 0 00-1 1v11a1 1 0 001 1z"/></svg>
    },
    { 
      to: '/trips', 
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
    },
    { 
      to: '/profile', 
      icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[#0B132B]/80 border-t border-white/10 rounded-t-[2.5rem] z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex justify-around items-center h-20 px-6 max-w-md mx-auto">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 relative ${
                isActive 
                  ? 'text-[#0B132B] bg-[#eae0c8] shadow-[0_0_20px_rgba(234,224,200,0.4)] scale-110' 
                  : 'text-[#9CA3AF] hover:text-[#eae0c8] hover:bg-white/5'
              }`
            }
          >
            {link.icon}
          </NavLink>
        ))}
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10"
          title="Logout"
        >
          <svg className="w-7 h-7 pl-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    </nav>
  );
}
