import React from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-transparent sticky top-0 z-40 p-4 pt-6">
      <div className="container-max flex items-center justify-center">
        <Link to="/dashboard" className="flex items-center gap-2 transition-transform hover:scale-105">
          <span className="text-3xl font-extrabold tracking-widest text-[#eae0c8] uppercase drop-shadow-xl">
            SafeCircles
          </span>
        </Link>
      </div>
    </header>
  );
}
