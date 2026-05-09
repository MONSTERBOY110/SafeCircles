import React from 'react';
import { Link } from 'react-router-dom';
import ScrollFrameSequence from '../components/ScrollFrameSequence';

const FEATURES = [
  {
    title: 'Verified Users',
    body: 'Only verified users can join the safety network.',
  },
  {
    title: 'Real-Time Matching',
    body: 'Users are matched by route proximity and travel timing.',
  },
  {
    title: 'SafeCircle Groups',
    body: 'Temporary trusted groups are formed for safer journeys.',
  },
  {
    title: 'In-App Coordination',
    body: 'Members can view meeting points, routes, and chat securely.',
  },
];

// Linear interp clamped to [0, 1] inverted for fade-out: returns 1 before
// `start`, 0 after `end`, and linearly fades between.
const fadeOutAt = (progress, start, end) =>
  Math.max(0, Math.min(1, 1 - (progress - start) / (end - start)));

// Cloudinary CDN base for landing-page frames. Falls back to local /frames
// if the env var is unset (useful for offline dev with the directory restored).
const FRAME_BASE = import.meta.env.VITE_CLOUDINARY_FRAMES_BASE || '/frames';

export default function Home() {
  // scframe1 has 240 frames, scframe2 has 170 frames.
  // In a flat sequence they run from frame 0 to 409 (410 total).
  // scframe1 ends at progress 240/410 ≈ 0.585.
  // We fade the hero text from progress 0.30 (mid-scframe1) to 0.55 (just
  // before scframe2 starts) so the overlay is fully gone by the time the
  // story transitions.
  const HERO_FADE_START = 0.30;
  const HERO_FADE_END = 0.55;

  return (
    <div className="min-h-screen font-sans bg-[#0B132B] text-[#EAE0C8] selection:bg-[#EAE0C8] selection:text-[#0B132B]">
      {/* 1+2. Hero + Story 2 — ONE continuous sticky stage so the canvas never
              unsticks between scframe1 and scframe2. The hero text fades out
              as scframe1 ends. */}
      <ScrollFrameSequence
        sequences={[
          { folderPath: `${FRAME_BASE}/scframes1`, lastFrame: 240 },
          { folderPath: `${FRAME_BASE}/scframes2`, lastFrame: 170 },
        ]}
        scrollHeight="600vh"
        overlayContent={({ progress }) => {
          const textOpacity = fadeOutAt(progress, HERO_FADE_START, HERO_FADE_END);
          // The dark gradient also fades out so scframe2 is presented cleanly.
          const gradientOpacity = fadeOutAt(progress, HERO_FADE_START + 0.05, HERO_FADE_END + 0.05);
          return (
            <div className="relative w-full h-full pointer-events-none">
              {/* Dark gradient backdrop for text readability — fades with the text */}
              <div
                className="absolute inset-0 bg-gradient-to-b from-[#0B132B]/40 via-[#0B132B]/20 to-[#0B132B]/80 transition-opacity"
                style={{ opacity: gradientOpacity }}
              />
              <div
                className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto transition-opacity"
                style={{
                  opacity: textOpacity,
                  // Once fully faded, drop the layer out of pointer-events so
                  // the canvas isn't blocked by an invisible overlay.
                  pointerEvents: textOpacity < 0.05 ? 'none' : undefined,
                }}
              >
                <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter text-[#EAE0C8] uppercase drop-shadow-2xl">
                  SafeCircles
                </h1>
                <p className="mt-4 text-2xl md:text-4xl font-semibold text-[#EAE0C8] drop-shadow-lg">
                  Walk safer. Together.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row gap-6 justify-center pointer-events-auto">
                  <Link
                    to="/signup"
                    className="px-12 py-4 bg-[#EAE0C8] text-[#0B132B] font-bold text-xl rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(234,224,200,0.4)] transition-all duration-300 ease-out text-center"
                  >
                    Sign Up
                  </Link>
                  <Link
                    to="/login"
                    className="px-12 py-4 border-2 border-[#EAE0C8] text-[#EAE0C8] font-bold text-xl rounded-full hover:bg-[#EAE0C8] hover:text-[#0B132B] hover:scale-105 hover:shadow-[0_0_30px_rgba(234,224,200,0.2)] transition-all duration-300 ease-out text-center"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
              {/* Subtle scroll cue — also fades with the hero text */}
              <div
                className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.4em] text-[#EAE0C8]/50 transition-opacity"
                style={{ opacity: textOpacity }}
              >
                Scroll
              </div>
            </div>
          );
        }}
      />

      {/* 3. About */}
      <section className="py-32 px-6 bg-[#0B132B]">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#EAE0C8] mb-6 tracking-tight">
            Safety through verified companionship
          </h2>
          <p className="text-lg md:text-xl text-[#EAE0C8]/70 leading-relaxed">
            SafeCircles helps women avoid unsafe solo travel by connecting them with
            nearby verified users travelling along similar routes. Instead of
            reacting after danger, SafeCircles focuses on prevention through
            real-time group formation.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/5 bg-[#111A3A]/70 backdrop-blur-md p-6 shadow-lg hover:border-blue-400/30 hover:shadow-[0_0_24px_rgba(59,130,246,0.08)] transition-all duration-300"
            >
              <h3 className="text-lg font-bold text-[#EAE0C8] mb-3 tracking-wide">
                {f.title}
              </h3>
              <p className="text-sm text-[#EAE0C8]/70 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Story 3 — scframes3 */}
      <ScrollFrameSequence
        folderPath={`${FRAME_BASE}/scframes3`}
        lastFrame={240}
        scrollHeight="300vh"
      />

      {/* 5. Footer */}
      <footer className="bg-[#0B132B] border-t border-white/10 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-2xl md:text-3xl font-bold text-[#EAE0C8] mb-4 tracking-tight">
            SafeCircles
          </p>
          <p className="text-base md:text-lg italic text-[#EAE0C8]/80 leading-relaxed mb-8">
            "A future where no <span className="text-[#EAE0C8] font-semibold not-italic">WOMAN</span> fears walking home after 7 PM"
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-[#EAE0C8]/40">
            Built by TeesMaarKhaCoders
          </p>
        </div>
      </footer>
    </div>
  );
}
