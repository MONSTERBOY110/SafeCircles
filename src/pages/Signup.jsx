import React from 'react';
import SignupForm from '../components/Auth/SignupForm';
import Header from '../components/Layout/Header';

export default function Signup() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🛡️</div>
            <h1 className="text-3xl font-bold text-gray-800">Join SafeCircles</h1>
            <p className="text-gray-500 mt-1">Create your free account</p>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
