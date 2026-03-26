import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen font-sans bg-[#0B132B] text-[#FDF6E3] selection:bg-[#FDF6E3] selection:text-[#0B132B] smooth-scroll">

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-6 overflow-hidden">
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-top bg-no-repeat"
          style={{ backgroundImage: "url('/hero-bg.png')" }}
        >
          {/* Subtle gradient overlay to ensure text readability without hiding the image */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B132B]/60 via-[#0B132B]/30 to-[#0B132B]"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto w-full">
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-[#eae0c8] mb-4 drop-shadow-2xl uppercase"
            style={{ animation: 'fadeInUp 1s ease-out forwards' }}>
            SafeCircles
          </h1>
          <h2 className="text-3xl md:text-5xl font-semibold text-[#FDF6E3] mb-8 drop-shadow-lg opacity-0"
            style={{ animation: 'fadeInUp 1s ease-out 0.3s forwards' }}>
            Walk safer. Together.
          </h2>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto opacity-0"
            style={{ animation: 'fadeInUp 1s ease-out 0.9s forwards' }}>
            <Link
              to="/signup"
              className="w-full sm:w-auto px-12 py-4 bg-[#eae0c8] text-[#0B132B] font-bold text-xl rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(234,224,200,0.4)] transition-all duration-300 ease-out text-center"
            >
              Sign Up
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-12 py-4 border-2 border-[#eae0c8] text-[#eae0c8] font-bold text-xl rounded-full hover:bg-[#eae0c8] hover:text-[#0B132B] hover:scale-105 hover:shadow-[0_0_30px_rgba(234,224,200,0.2)] transition-all duration-300 ease-out text-center"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="py-32 px-6 bg-[#0B132B] flex justify-center items-center text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-3xl md:text-4xl lg:text-5xl font-light text-[#eae0c8] leading-tight py-12 px-4 opacity-90 border-y border-[#eae0c8]/20 transition-opacity duration-700 hover:opacity-100">
            "A future where no woman fears walking home after 7 PM"
          </p>
        </div>
      </section>

      {/* SOLUTION HIGHLIGHT */}
      <section className="py-24 px-6 bg-[#111A3A]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center">
            {/* Point 1 */}
            <div className="flex flex-col items-center group">
              <div className="w-24 h-24 bg-[#eae0c8]/10 rounded-full flex items-center justify-center mb-8 group-hover:-translate-y-2 group-hover:scale-110 group-hover:bg-[#eae0c8]/20 group-hover:shadow-[0_0_20px_rgba(234,224,200,0.15)] transition-all duration-500">
                <svg className="w-10 h-10 text-[#eae0c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-[#eae0c8] mb-4 tracking-wide">Verified Users</h3>
              <p className="text-[#9CA3AF] text-lg leading-relaxed">
                Identity verified instantly. No fake profiles, just real people you can trust.
              </p>
            </div>

            {/* Point 2 */}
            <div className="flex flex-col items-center group">
              <div className="w-24 h-24 bg-[#eae0c8]/10 rounded-full flex items-center justify-center mb-8 group-hover:-translate-y-2 group-hover:scale-110 group-hover:bg-[#eae0c8]/20 group-hover:shadow-[0_0_20px_rgba(234,224,200,0.15)] transition-all duration-500">
                <svg className="w-10 h-10 text-[#eae0c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-[#eae0c8] mb-4 tracking-wide">Real Time Groups</h3>
              <p className="text-[#9CA3AF] text-lg leading-relaxed">
                Connect and coordinate with trusted companions heading your way.
              </p>
            </div>

            {/* Point 3 */}
            <div className="flex flex-col items-center group">
              <div className="w-24 h-24 bg-[#eae0c8]/10 rounded-full flex items-center justify-center mb-8 group-hover:-translate-y-2 group-hover:scale-110 group-hover:bg-[#eae0c8]/20 group-hover:shadow-[0_0_20px_rgba(234,224,200,0.15)] transition-all duration-500">
                <svg className="w-10 h-10 text-[#eae0c8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-[#eae0c8] mb-4 tracking-wide">Safer Journeys</h3>
              <p className="text-[#9CA3AF] text-lg leading-relaxed">
                Walk with peace of mind. Arrive at your destination safely, together.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Inline styles for custom animations to avoid modifying global CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .smooth-scroll {
          scroll-behavior: smooth;
        }
      `}} />
    </div>
  );
}
