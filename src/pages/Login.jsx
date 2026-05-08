import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-wordmark">
            <ShieldCheck size={28} color="var(--color-700)" fill="rgba(0,119,182,0.12)" />
            SafeCircles
          </div>
          <p className="auth-tagline">Travel safe, together</p>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to continue your safe journey</p>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <div className="input-with-icon">
              <Mail className="input-icon" />
              <input
                type="email"
                required
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          
          <div className="input-group">
            <label className="input-label">Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input-field pr-12"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="button" className="btn-ghost mb-2 px-0">
            Forgot password?
          </button>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Processing...' : 'Login'}
          </button>
        </form>

        <div className="divider" />

        <p className="text-center text-[13px] font-medium text-[var(--text-caption)]">
          Don't have an account?{' '}
          <Link to="/signup">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
