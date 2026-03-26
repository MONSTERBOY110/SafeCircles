import React from 'react';
import UserProfile from '../components/Profile/UserProfile';
import Settings from '../components/Profile/Settings';
import EmergencyContacts from '../components/Emergency/EmergencyContacts';
import Header from '../components/Layout/Header';
import Navigation from '../components/Layout/Navigation';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col font-sans text-[#eae0c8] relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 w-full px-4 py-8 pb-32 max-w-md mx-auto flex flex-col">
          <h1 className="text-3xl font-extrabold text-[#eae0c8] text-center tracking-tight mb-8">Your Profile</h1>
          
          <div className="w-full space-y-6 
            [&_.bg-white]:!bg-white/5 [&_.bg-white]:backdrop-blur-xl [&_.bg-white]:!border [&_.bg-white]:!border-white/10 [&_.bg-white]:!rounded-[2rem] [&_.bg-white]:!shadow-2xl 
            [&_h2]:!text-[#eae0c8] [&_h3]:!text-[#eae0c8] [&_p]:!text-[#9CA3AF] 
            [&_.text-gray-800]:!text-[#eae0c8] [&_.text-gray-500]:!text-[#9CA3AF] [&_.text-gray-600]:!text-[#9CA3AF]
            [&_.bg-gray-50]:!bg-white/5 [&_.border-gray-200]:!border-white/10
            [&_.bg-blue-50]:!bg-blue-500/10 [&_.text-blue-600]:!text-blue-400 
            [&_.bg-green-50]:!bg-green-500/10 [&_.text-green-600]:!text-green-400
            [&_input]:!bg-[#111A3A]/80 [&_input]:!text-[#eae0c8] [&_input]:!border-white/10 [&_input]:focus:!ring-blue-500
            [&_button.bg-blue-600]:!bg-blue-600/90 [&_button.bg-blue-600:hover]:!bg-blue-500 [&_button.bg-blue-600]:!transition-all [&_button.bg-blue-600]:!rounded-[1.5rem]
            [&_button.bg-red-50]:!bg-red-500/10 [&_button.bg-red-50]:!text-red-400 [&_button.bg-red-50:hover]:!bg-red-500/20
          ">
            <UserProfile />
            <EmergencyContacts />
            <Settings />
          </div>
        </main>
        <Navigation />
      </div>
    </div>
  );
}
