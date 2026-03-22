import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Layout/Header';
import Footer from '../components/Layout/Footer';

const FEATURES = [
  {
    icon: '🔐',
    title: '3-Step Verification',
    desc: 'Face detection, liveness check, and voice analysis to confirm real users',
  },
  {
    icon: '👥',
    title: 'Smart Matching',
    desc: 'Auto-matched with verified women on the same route and time window',
  },
  {
    icon: '🗺️',
    title: 'Live Maps',
    desc: 'Meeting points marked with CCTV cameras and police booth locations',
  },
  {
    icon: '🚨',
    title: 'Emergency Tools',
    desc: 'Fake call, instant location share, circle alert, and direct helplines',
  },
  {
    icon: '⭐',
    title: 'Reputation System',
    desc: 'Trust built through completed safe trips — the more you walk, the more trusted you become',
  },
  {
    icon: '🛡️',
    title: 'Privacy First',
    desc: 'Only geohash-rounded positions stored. Video never saved. Data auto-deleted.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-24 px-4">
        <div className="container-max text-center max-w-3xl mx-auto">
          <div className="text-7xl mb-6">🛡️</div>
          <h1 className="text-5xl font-bold mb-4 leading-tight">
            Walk Safe.<br />Walk Together.
          </h1>
          <p className="text-xl text-blue-100 mb-10 max-w-xl mx-auto">
            SafeCircles connects verified women for safe group walks — matched in seconds, protected always.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/signup" className="bg-white text-blue-700 font-bold px-8 py-4 rounded-xl text-lg hover:bg-blue-50 transition shadow-lg">
              Get Started — Free
            </Link>
            <Link to="/login" className="border-2 border-white text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-white hover:text-blue-700 transition">
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container-max">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">How SafeCircles Protects You</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow hover:shadow-lg transition">
                <div className="text-4xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 text-white py-16 px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to walk safely?</h2>
        <p className="text-blue-200 mb-8">Join thousands of verified women walking safe every day.</p>
        <Link to="/signup" className="bg-white text-blue-700 font-bold px-10 py-4 rounded-xl text-lg hover:bg-blue-50 transition inline-block">
          Create Your Account
        </Link>
      </section>

      <Footer />
    </div>
  );
}
