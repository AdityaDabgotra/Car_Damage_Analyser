'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    // Client-side validation
    const errs: Record<string, string> = {};
    if (form.name.length < 2) errs.name = 'Name must be at least 2 characters';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Invalid email address';
    if (form.password.length < 8) errs.password = 'Minimum 8 characters';
    if (!/[A-Z]/.test(form.password)) errs.password = 'Must contain an uppercase letter';
    if (!/[0-9]/.test(form.password)) errs.password = 'Must contain a number';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!data.success) {
        setServerError(data.error?.message ?? 'Registration failed');
        setLoading(false);
        return;
      }

      // Auto-login after registration
      await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      router.push('/dashboard');
    } catch {
      setServerError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <span className="logo-mark">◈</span> ClaimVision
        </Link>
        <h1>Create account</h1>
        <p className="auth-sub">Start analyzing claims in minutes</p>

        <button
          className="btn-google"
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign up with Google
        </button>

        <div className="divider"><span>or</span></div>

        <form onSubmit={handleSubmit} className="auth-form">
          {serverError && <div className="auth-error">{serverError}</div>}

          {(['name', 'email', 'password', 'confirmPassword'] as const).map(field => (
            <div className="field" key={field}>
              <label htmlFor={field}>
                {field === 'confirmPassword' ? 'Confirm Password' : field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                id={field}
                type={field.includes('assword') ? 'password' : field === 'email' ? 'email' : 'text'}
                value={form[field]}
                onChange={e => update(field, e.target.value)}
                placeholder={
                  field === 'name' ? 'Jane Smith' :
                  field === 'email' ? 'you@example.com' : '••••••••'
                }
                className={errors[field] ? 'input-error' : ''}
              />
              {errors[field] && <span className="field-error">{errors[field]}</span>}
            </div>
          ))}

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link href="/auth/login">Sign in</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-wrapper {
          min-height: 100vh; display: flex; align-items: center;
          justify-content: center; background: #080a0f; padding: 1.5rem;
        }
        .auth-card {
          width: 100%; max-width: 420px; background: #0d1117;
          border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 2.5rem;
        }
        .auth-logo { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 1.1rem; color: #f0f4ff; text-decoration: none; margin-bottom: 2rem; }
        .logo-mark { color: #4ade80; font-size: 1.3rem; }
        h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; color: #f0f4ff; margin-bottom: 0.4rem; }
        .auth-sub { color: #6b7280; font-size: 0.9rem; margin-bottom: 2rem; }
        .btn-google { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.7rem; padding: 0.75rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; background: rgba(255,255,255,0.03); color: #e8eaf0; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-google:hover { background: rgba(255,255,255,0.07); }
        .divider { display: flex; align-items: center; gap: 1rem; margin: 1.5rem 0; color: #374151; font-size: 0.8rem; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .auth-error { padding: 0.75rem 1rem; border-radius: 8px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); color: #f87171; font-size: 0.85rem; }
        .field { display: flex; flex-direction: column; gap: 0.35rem; }
        label { font-size: 0.82rem; font-weight: 600; color: #9ca3af; }
        input { padding: 0.7rem 0.9rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #f0f4ff; font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
        input:focus { border-color: rgba(74,222,128,0.4); }
        input.input-error { border-color: rgba(248,113,113,0.4); }
        input::placeholder { color: #374151; }
        .field-error { font-size: 0.78rem; color: #f87171; }
        .btn-submit { margin-top: 0.5rem; padding: 0.8rem; border-radius: 10px; border: none; background: #4ade80; color: #080a0f; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; min-height: 44px; }
        .btn-submit:hover:not(:disabled) { background: #86efac; }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #080a0f; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-footer { margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: #6b7280; }
        .auth-footer a { color: #4ade80; font-weight: 600; }
      `}</style>
    </div>
  );
}
