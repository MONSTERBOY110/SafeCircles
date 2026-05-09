import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    
    try {
      setLoading(true);

      console.log('Step 1: Starting authentication...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('✅ Auth success:', user.uid);
      console.log('Step 2: Saving to Firestore...');

      const userDocRef = doc(db, 'users', user.uid);
      console.log('Doc reference created:', userDocRef.path);

      const userData = {
        uid: user.uid,
        email: user.email,
        name: name,
        isVerified: false,
        reputation: 0,
        createdAt: serverTimestamp()
      };

      console.log('Attempting setDoc with data:', userData);
      
      try {
        console.log('📡 Testing Firestore connection...');
        
        // Try a simple write first
        await setDoc(userDocRef, userData);
        console.log('✅ Firestore write success');
        
      } catch (firestoreError) {
        console.error('Firestore error details:', {
          code: firestoreError.code,
          message: firestoreError.message,
          name: firestoreError.name
        });
        throw firestoreError;
      }
      console.log('🎉 All steps complete, navigating to dashboard...');
      toast.success('Account created!');
      navigate('/dashboard');
      console.log('📍 Navigate called - should go to /dashboard now');

    } catch (error) {
      console.error('❌ Signup error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      
      setError(error.message || 'Signup failed. Please try again.');
      toast.error(error.message);
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

        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Join verified companions for safer trips</p>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div className="input-group">
            <label className="input-label">Full Name</label>
            <div className="input-with-icon">
              <UserRound className="input-icon" />
              <input
                type="text"
                required
                className="input-field"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          
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
                placeholder="Min. 6 characters"
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

          <div className="input-group">
            <label className="input-label">Confirm Password</label>
            <div className="input-with-icon">
              <Lock className="input-icon" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                className="input-field pr-12"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2"
          >
            {loading ? 'Processing...' : 'Create Account'}
          </button>
        </form>

        <div className="divider" />

        <p className="text-center text-[13px] font-medium text-[var(--text-caption)]">
          Already have an account?{' '}
          <Link to="/login">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
