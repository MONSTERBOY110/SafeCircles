import React from 'react';
import UserProfile from '../components/Profile/UserProfile';
import Settings from '../components/Profile/Settings';
import EmergencyContacts from '../components/Emergency/EmergencyContacts';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';
import PageTransition from '../components/PageTransition';

export default function ProfilePage() {
  return (
    <div className="app-shell">
      <Header title="Profile" />
      <PageTransition>
        <UserProfile />
        <EmergencyContacts />
        <Settings />
      </PageTransition>
      <Navigation />
    </div>
  );
}
