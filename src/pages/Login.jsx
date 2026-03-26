import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  
  // Reactively navigate to dashboard the millisecond the user authenticates
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Logged in! Redirecting...');
      
      // Navigate immediately - dashboard loads fast
      navigate('/dashboard');
      
    } catch (err) {
      const message = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
        ? 'Invalid email or password'
        : err.message || 'Login failed. Please try again.';
      setError(message);
      toast.error(message);
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
          Welcome Back
        </h1>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600/90 text-white font-bold py-3 rounded-lg hover:bg-blue-500 hover:scale-105 hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none mt-2"
          >
            {loading ? 'Processing...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[#eae0c8]/70 text-sm mt-6">
          New here?{' '}
          <Link to="/signup" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
