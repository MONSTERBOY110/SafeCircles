import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function SignupForm() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(form.email, form.password, form.name);
      toast.success('Account created! Redirecting to dashboard...');
      // Give auth state a moment to update with userData
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block font-semibold mb-1 text-gray-700">Full Name</label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          className="input-field"
          placeholder="Your name"
          required
          autoComplete="name"
        />
      </div>
      <div>
        <label className="block font-semibold mb-1 text-gray-700">Email</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          className="input-field"
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block font-semibold mb-1 text-gray-700">Password</label>
        <input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          className="input-field"
          placeholder="Min. 6 characters"
          required
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="block font-semibold mb-1 text-gray-700">Confirm Password</label>
        <input
          type="password"
          name="confirm"
          value={form.confirm}
          onChange={handleChange}
          className="input-field"
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
      <p className="text-center text-gray-600 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
