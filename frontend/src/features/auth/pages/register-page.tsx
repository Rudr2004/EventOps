import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth-context';
import { FormField } from '../../../components/layout/form-field';
import { Alert } from '../../../components/layout/alert';

export function RegisterPage() {
  const { register, registerError, isRegisterPending } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await register({ name, email, password });
      navigate('/', { replace: true });
    } catch {
      // error surfaced via registerError from auth context
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
        <h1>Create your account</h1>
        <p className="auth-form-sub">New accounts start as a Viewer — an Admin can promote your role.</p>
        {registerError && <Alert message={registerError} />}
        <FormField
          id="name"
          label="Full name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
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
          minLength={8}
          autoComplete="new-password"
        />
        <button type="submit" disabled={isRegisterPending}>
          {isRegisterPending ? 'Creating account…' : 'Register'}
        </button>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </motion.form>
    </div>
  );
}
