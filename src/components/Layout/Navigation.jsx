import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, Map, UserRound } from 'lucide-react';

export default function Navigation() {
  const shouldReduceMotion = useReducedMotion();
  const links = [
    { to: '/trips', label: 'Trips', Icon: Map },
    { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { to: '/profile', label: 'Profile', Icon: UserRound },
  ];

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {({ isActive }) => (
              <>
                {isActive && !shouldReduceMotion && (
                  <motion.div
                    className="nav-active-indicator"
                    layoutId="nav-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                {isActive && shouldReduceMotion && <div className="nav-active-indicator" />}
                <Icon className="nav-icon" strokeWidth={2.3} />
                <span className="nav-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
