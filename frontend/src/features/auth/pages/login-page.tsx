import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth-context';
import { FormField } from '../../../components/layout/form-field';
import { Alert } from '../../../components/layout/alert';

export function LoginPage() {
  const { login, loginError, isLoginPending } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch {
      // error surfaced via loginError from auth context
    }
  };

  return (
    <div className="auth-page">
      <motion.form
        className="auth-form"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="app-brand-mark" style={{ marginBottom: 4 }}>
          Eo
        </span>
        <h1>Welcome back</h1>
        <p className="auth-form-sub">Sign in to your EventOps workspace.</p>
        {loginError && <Alert message={loginError} />}
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button type="submit" disabled={isLoginPending}>
          {isLoginPending ? 'Logging in…' : 'Log in'}
        </button>
        <p>
          Don&apos;t have an account? <Link to="/register">Register</Link>
        </p>
      </motion.form>
    </div>
  );
}
