import React from 'react';
import CreateTrip from '../components/Trip/CreateTrip';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';

export default function CreateTripPage() {
  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col font-sans text-[#eae0c8] relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 w-full pb-32">
          <CreateTrip />
        </main>
        <Navigation />
      </div>
    </div>
  );
}
