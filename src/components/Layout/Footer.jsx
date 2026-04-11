import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 bg-[#111A3A] py-8 text-sm text-[#EAE0C8]/50">
      <div className="container-max flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-xl">SafeCircles</span>
          <span className="text-[#EAE0C8] font-bold">Walk Safe Together</span>
        </div>
        <div className="flex gap-6">
          <span>Emergency: <a href="tel:100" className="text-[#EAE0C8] hover:text-blue-300 hover:underline">100</a></span>
          <span>Women's: <a href="tel:1090" className="text-[#EAE0C8] hover:text-blue-300 hover:underline">1090</a></span>
        </div>
        <p>{new Date().getFullYear()} SafeCircles. MIT License.</p>
      </div>
    </footer>
  );
}
