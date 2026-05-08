import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navigation() {
  const links = [
    {
      to: '/trips',
      label: 'Trips',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      featured: false,
    },
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
        </svg>
      ),
      featured: true,
    },
    {
      to: '/profile',
      label: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      featured: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[#0B132B]/85 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="mx-auto flex h-20 max-w-md items-center justify-around px-6">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              link.featured
                ? `flex min-w-[96px] flex-col items-center justify-center gap-1 rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? 'scale-110 bg-blue-600/90 text-[#eae0c8] shadow-[0_0_18px_rgba(59,130,246,0.45)]'
                      : 'scale-110 bg-blue-600/80 text-[#eae0c8] shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:bg-blue-500/90'
                  }`
                : `flex min-w-[76px] flex-col items-center justify-center gap-1 px-3 py-2 text-sm font-medium transition-colors duration-300 ${
                    isActive ? 'text-[#eae0c8]' : 'text-[#eae0c8]/70 hover:text-[#eae0c8]'
                  }`
            }
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
