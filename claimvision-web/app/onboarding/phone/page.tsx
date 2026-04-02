'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PhoneOnboardingPage() {
  const router = useRouter();
  const { update } = useSession();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/user/phone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message ?? 'Could not save phone number');
        setLoading(false);
        return;
      }

      await update();
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="onboarding-wrap">
      <div className="onboarding-card">
        <Link href="/" className="onboarding-logo">
          <span className="logo-mark">◈</span> ClaimVision
        </Link>
        <h1>Your phone number</h1>
        <p className="onboarding-sub">
          We use this to reach you about your claims. You can update it later in your profile.
        </p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {error && <div className="onboarding-error">{error}</div>}

          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Continue to dashboard'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .onboarding-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #080a0f;
          padding: 1.5rem;
        }
        .onboarding-card {
          width: 100%;
          max-width: 420px;
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          padding: 2.5rem;
        }
        .onboarding-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1.1rem;
          color: #f0f4ff;
          text-decoration: none;
          margin-bottom: 2rem;
        }
        .logo-mark {
          color: #4ade80;
          font-size: 1.3rem;
        }
        h1 {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #f0f4ff;
          margin-bottom: 0.4rem;
        }
        .onboarding-sub {
          color: #6b7280;
          font-size: 0.9rem;
          margin-bottom: 2rem;
          line-height: 1.5;
        }
        .onboarding-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .onboarding-error {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.2);
          color: #f87171;
          font-size: 0.85rem;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        label {
          font-size: 0.82rem;
          font-weight: 600;
          color: #9ca3af;
          letter-spacing: 0.02em;
        }
        input {
          padding: 0.7rem 0.9rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: #f0f4ff;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus {
          border-color: rgba(74, 222, 128, 0.4);
        }
        input::placeholder {
          color: #374151;
        }
        .btn-submit {
          margin-top: 0.5rem;
          padding: 0.8rem;
          border-radius: 10px;
          border: none;
          background: #4ade80;
          color: #080a0f;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
        }
        .btn-submit:hover:not(:disabled) {
          background: #86efac;
        }
        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(0, 0, 0, 0.2);
          border-top-color: #080a0f;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
