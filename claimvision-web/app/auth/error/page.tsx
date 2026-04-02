'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: 'Error starting OAuth sign-in. Please try again.',
  OAuthCallback: 'Error during OAuth callback. Please try again.',
  OAuthCreateAccount: 'Could not create OAuth account. Email may already be registered.',
  EmailCreateAccount: 'Could not create account with this email.',
  Callback: 'Authentication callback error.',
  OAuthAccountNotLinked: 'This email is already registered with a different sign-in method.',
  default: 'An authentication error occurred. Please try again.',
};

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get('error') ?? 'default';
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default;

  return (
    <div className="error-card">
      <div className="error-icon">⚠</div>
      <h1>Sign-in Error</h1>
      <p>{message}</p>
      <div className="error-actions">
        <Link href="/auth/login" className="btn-primary">Try Again</Link>
        <Link href="/" className="btn-ghost">Go Home</Link>
      </div>

      <style jsx>{`
        .error-card {
          display: flex; flex-direction: column; align-items: center;
          gap: 1rem; text-align: center;
          max-width: 400px; width: 100%;
          background: #0d1117; border: 1px solid rgba(248,113,113,0.2);
          border-radius: 16px; padding: 2.5rem;
        }
        .error-icon { font-size: 2.5rem; color: #f87171; }
        h1 { font-size: 1.5rem; font-weight: 800; color: #f0f4ff; letter-spacing: -0.02em; }
        p { font-size: 0.9rem; color: #9ca3af; line-height: 1.6; }
        .error-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
        .btn-primary { padding: 0.65rem 1.25rem; border-radius: 8px; background: #4ade80; color: #080a0f; font-weight: 700; font-size: 0.88rem; text-decoration: none; }
        .btn-ghost { padding: 0.65rem 1.25rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; font-size: 0.88rem; text-decoration: none; }
      `}</style>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080a0f', padding: '1.5rem' }}>
      <Suspense fallback={<div style={{ color: '#6b7280' }}>Loading...</div>}>
        <ErrorContent />
      </Suspense>
    </div>
  );
}
