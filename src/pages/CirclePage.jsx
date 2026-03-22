import React from 'react';
import { useParams } from 'react-router-dom';
import SafeCircleView from '../components/Circle/SafeCircleView';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';

export default function CirclePage() {
  const { circleId } = useParams();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pb-20 md:pb-0">
        <SafeCircleView circleId={circleId} />
      </main>
      <Navigation />
    </div>
  );
}
