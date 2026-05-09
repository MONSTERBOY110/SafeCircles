import React from 'react';
import CreateTrip from '../components/Trip/CreateTrip';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import PageTransition from '../components/PageTransition';

export default function CreateTripPage() {
  return (
    <div className="app-shell">
      <Header />
      <PageTransition>
        <CreateTrip />
      </PageTransition>
      <Navigation />
    </div>
  );
}
