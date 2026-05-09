import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [isFlashing, setIsFlashing] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const isDark = theme === 'dark';

  const handleToggle = () => {
    if (shouldReduceMotion) {
      toggleTheme();
      return;
    }

    setIsFlashing(true);
    window.setTimeout(() => {
      toggleTheme();
      window.setTimeout(() => setIsFlashing(false), 80);
    }, 80);
  };

  return (
    <>
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            key="theme-flash"
            className="theme-flash-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleToggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="theme-toggle-btn"
        whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
        whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <motion.div
          className="toggle-track"
          animate={{ backgroundColor: isDark ? '#140152' : '#caf0f8' }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: 'easeInOut' }}
        >
          <motion.div
            className="toggle-thumb"
            animate={{
              x: isDark ? 22 : 2,
              backgroundColor: isDark ? '#4433ff' : '#0077b6',
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 28,
              duration: shouldReduceMotion ? 0 : undefined,
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isDark ? (
                <motion.span
                  key="moon"
                  initial={shouldReduceMotion ? false : { opacity: 0, rotate: -30, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, rotate: 30, scale: 0.6 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                >
                  <Moon size={12} color="#ffffff" strokeWidth={2.5} />
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  initial={shouldReduceMotion ? false : { opacity: 0, rotate: 30, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, rotate: -30, scale: 0.6 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                >
                  <Sun size={12} color="#ffffff" strokeWidth={2.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.button>
    </>
  );
}
