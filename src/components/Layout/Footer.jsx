import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-400 text-sm py-8 mt-auto">
      <div className="container-max flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <span className="text-white font-bold">SafeCircles</span>
          <span>— Walk Safe Together</span>
        </div>
        <div className="flex gap-6">
          <span>Emergency: <a href="tel:100" className="text-white hover:underline">100</a></span>
          <span>Women's: <a href="tel:1090" className="text-white hover:underline">1090</a></span>
        </div>
        <p>© {new Date().getFullYear()} SafeCircles. MIT License.</p>
      </div>
    </footer>
  );
}
