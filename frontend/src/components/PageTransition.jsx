import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export default function PageTransition({ children, className = '' }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.main
      className={`page-content ${className}`.trim()}
      variants={shouldReduceMotion ? undefined : pageVariants}
      initial={shouldReduceMotion ? false : 'initial'}
      animate="enter"
      exit={shouldReduceMotion ? undefined : 'exit'}
      transition={{ type: 'tween', ease: 'easeOut', duration: shouldReduceMotion ? 0 : 0.25 }}
    >
      {children}
    </motion.main>
  );
}
