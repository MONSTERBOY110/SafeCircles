import React from 'react';
import UserProfile from '../components/Profile/UserProfile';
import Settings from '../components/Profile/Settings';
import EmergencyContacts from '../components/Emergency/EmergencyContacts';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 container-max py-10 pb-24 md:pb-10 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Your Profile</h1>
        <UserProfile />
        <EmergencyContacts />
        <Settings />
      </main>
      <Navigation />
    </div>
  );
}
