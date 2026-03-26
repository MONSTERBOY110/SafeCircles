import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Signup() {
  const navigate = useNavigate();
  const { signup, user } = useAuth();
  
  // Reactively navigate to dashboard the millisecond the user authenticates
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);

    try {
      // WAIT for signup to complete (auth + firestore write)
      await signup(email, password, name);
      toast.success('Account created!');
      
      // User data is already loaded in context, redirect immediately
      navigate('/dashboard');
      
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-top bg-no-repeat relative"
      style={{ backgroundImage: "url('/hero-bg.png')" }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/80 z-0"></div>

      {/* Glassmorphism Card */}
      <div className="relative z-10 bg-[#0B132B]/60 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-[400px] border border-white/10">
        <h1 className="text-3xl font-extrabold text-[#eae0c8] text-center mb-6 tracking-wide">
          Create your SafeCircle
        </h1>
        
        {/* Error Message Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#eae0c8]/80 mb-1">Full Name</label>
            <input
              type="text"
              required
              className="w-full bg-[#0B132B]/50 border border-white/10 text-[#eae0c8] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-white/30 transition-all"
              placeholder=""
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#eae0c8]/80 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full bg-[#0B132B]/50 border border-white/10 text-[#eae0c8] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-white/30 transition-all"
              placeholder=""
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#eae0c8]/80 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full bg-[#0B132B]/50 border border-white/10 text-[#eae0c8] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-white/30 transition-all"
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#eae0c8]/80 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              className="w-full bg-[#0B132B]/50 border border-white/10 text-[#eae0c8] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-white/30 transition-all"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600/90 text-white font-bold py-3 rounded-lg hover:bg-blue-500 hover:scale-105 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none mt-2"
          >
            {loading ? 'Processing...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-[#eae0c8]/70 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
