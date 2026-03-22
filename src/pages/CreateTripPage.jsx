import React from 'react';
import CreateTrip from '../components/Trip/CreateTrip';
import Header from '../components/Layout/Header';

export default function CreateTripPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <CreateTrip />
      </main>
    </div>
  );
}
