import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B132B] text-center px-4 text-[#EAE0C8]">
      <div className="text-8xl mb-6">404</div>
      <h1 className="text-5xl font-bold text-[#EAE0C8] mb-4">Page not found</h1>
      <h2 className="text-2xl font-semibold text-[#EAE0C8]/70 mb-2">This route does not exist.</h2>
      <p className="text-[#EAE0C8]/50 mb-8">The page you are looking for could not be found.</p>
      <Link to="/" className="btn-primary">Back to Home</Link>
    </div>
  );
}
