import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { isRememberMeEnabled } from '../utils/authStorage';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(() => isRememberMeEnabled());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password, rememberMe);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Welcome back" 
      subtitle="Connect with your team in real-time."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-accent/10 border border-accent/20 text-accent px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="name@company.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-border bg-slate-900 text-primary focus:ring-primary/20"
            />
            <span>Remember me</span>
          </label>
          <a href="#" className="text-primary hover:underline">Forgot password?</a>
        </div>

        <Button type="submit" className="w-full" isLoading={loading}>
          Sign in
        </Button>

        <p className="text-center text-secondary text-sm pt-2">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default Login;
