import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import ThemeToggle from '../ThemeToggle';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const isCircle = location.pathname.startsWith('/circle');

  return (
    <motion.header
      className="topbar"
      initial={shouldReduceMotion ? false : { y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: 'easeOut' }}
    >
      <div className="topbar-inner">
        <div className="topbar-left">
          {isCircle ? (
            <motion.button
              type="button"
              className="topbar-back-btn"
              onClick={() => navigate('/trips')}
              aria-label="Back to trips"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            >
              <ChevronLeft size={22} />
            </motion.button>
          ) : (
            <Link to="/dashboard" className="topbar-logo" aria-label="SafeCircles dashboard">
              SafeCircles
            </Link>
          )}
        </div>

        <div className="topbar-right">
          <ThemeToggle />
        </div>
      </div>
    </motion.header>
  );
}
