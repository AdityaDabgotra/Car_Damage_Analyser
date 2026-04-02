'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push('/dashboard');
  }, [session, router]);

  return (
    <main className="landing">
      <nav className="nav">
        <div className="nav-logo">
          <span className="logo-icon">◈</span>
          <span>ClaimVision</span>
        </div>
        <div className="nav-actions">
          <Link href="/auth/login" className="btn-ghost">Sign In</Link>
          <Link href="/auth/register" className="btn-primary">Get Started</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge">AI-Powered Insurance Assessment</div>
        <h1 className="hero-title">
          <span className="title-line">Your Claim,</span>
          <span className="title-line accent">Analyzed in</span>
          <span className="title-line">Seconds.</span>
        </h1>
        <p className="hero-sub">
          Upload a 30-second video of your car damage. Our AI computer vision engine detects every dent, scratch, and structural issue — then generates a complete insurance recommendation instantly.
        </p>
        <div className="hero-cta">
          <Link href="/auth/register" className="btn-primary btn-lg">
            Start Your Claim
            <span className="btn-arrow">→</span>
          </Link>
          <span className="hero-note">No credit card required</span>
        </div>

        <div className="hero-stats">
          <div className="stat">
            <span className="stat-num">98.4%</span>
            <span className="stat-label">Detection Accuracy</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">&lt;30s</span>
            <span className="stat-label">Analysis Time</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-num">50k+</span>
            <span className="stat-label">Claims Processed</span>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="feature-card">
          <div className="feature-icon">◎</div>
          <h3>Computer Vision Analysis</h3>
          <p>Multi-frame video analysis detects damage severity with 92%+ confidence scoring on every detected part.</p>
        </div>
        <div className="feature-card feature-card--accent">
          <div className="feature-icon">⬡</div>
          <h3>AI Repair Recommendations</h3>
          <p>LLM-powered decisions determine repair vs. replace with cost estimates and detailed reasoning.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">◈</div>
          <h3>Instant Documentation</h3>
          <p>Full claim history, structured reports, and audit trails — ready for your insurance provider.</p>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          {[
            { num: '01', title: 'Upload Video', desc: 'Record up to 30 seconds of car damage footage' },
            { num: '02', title: 'CV Analysis', desc: 'Our AI scans every frame for damage signatures' },
            { num: '03', title: 'AI Report', desc: 'Receive repair/replace recommendations with cost ranges' },
            { num: '04', title: 'Claim Ready', desc: 'Export structured data for your insurance provider' },
          ].map(step => (
            <div className="step" key={step.num}>
              <span className="step-num">{step.num}</span>
              <h4>{step.title}</h4>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <span>© 2025 ClaimVision. Built for scale.</span>
        <span className="footer-stack">Next.js · MongoDB · OpenAI · Cloudinary</span>
      </footer>

      <style jsx>{`
        :global(*) { margin: 0; padding: 0; box-sizing: border-box; }
        :global(body) {
          background: #080a0f;
          color: #e8eaf0;
          font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
          min-height: 100vh;
        }

        .landing { min-height: 100vh; }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 4rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: sticky;
          top: 0;
          background: rgba(8,10,15,0.9);
          backdrop-filter: blur(20px);
          z-index: 100;
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .logo-icon { color: #4ade80; font-size: 1.4rem; }
        .nav-actions { display: flex; gap: 1rem; align-items: center; }

        .btn-ghost {
          padding: 0.5rem 1.2rem;
          border-radius: 8px;
          text-decoration: none;
          color: #9ca3af;
          transition: color 0.2s;
          font-size: 0.9rem;
        }
        .btn-ghost:hover { color: #fff; }
        .btn-primary {
          padding: 0.6rem 1.4rem;
          border-radius: 8px;
          background: #4ade80;
          color: #080a0f;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.9rem;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .btn-primary:hover { background: #86efac; transform: translateY(-1px); }
        .btn-lg { padding: 0.9rem 2rem; font-size: 1rem; border-radius: 10px; }
        .btn-arrow { transition: transform 0.2s; }
        .btn-primary:hover .btn-arrow { transform: translateX(4px); }

        .hero {
          max-width: 860px;
          margin: 0 auto;
          padding: 7rem 2rem 5rem;
          text-align: center;
        }
        .hero-badge {
          display: inline-block;
          padding: 0.35rem 1rem;
          border: 1px solid rgba(74,222,128,0.3);
          border-radius: 100px;
          color: #4ade80;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 2.5rem;
          background: rgba(74,222,128,0.06);
        }
        .hero-title {
          display: flex;
          flex-direction: column;
          font-size: clamp(3.5rem, 8vw, 6rem);
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.04em;
          margin-bottom: 1.8rem;
          color: #f0f4ff;
        }
        .title-line.accent { color: #4ade80; }
        .hero-sub {
          font-size: 1.15rem;
          color: #6b7280;
          line-height: 1.7;
          max-width: 580px;
          margin: 0 auto 2.5rem;
        }
        .hero-cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 4rem;
        }
        .hero-note { font-size: 0.8rem; color: #4b5563; }

        .hero-stats {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 2.5rem;
          padding: 2rem;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          background: rgba(255,255,255,0.02);
        }
        .stat { display: flex; flex-direction: column; gap: 0.3rem; }
        .stat-num { font-size: 1.8rem; font-weight: 800; color: #f0f4ff; letter-spacing: -0.03em; }
        .stat-label { font-size: 0.78rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
        .stat-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.1); }

        .features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          max-width: 1100px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }
        .feature-card {
          padding: 2rem;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          background: rgba(255,255,255,0.02);
          transition: border-color 0.2s, transform 0.2s;
        }
        .feature-card:hover { border-color: rgba(74,222,128,0.2); transform: translateY(-3px); }
        .feature-card--accent { border-color: rgba(74,222,128,0.15); background: rgba(74,222,128,0.03); }
        .feature-icon { font-size: 2rem; margin-bottom: 1rem; color: #4ade80; }
        .feature-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.7rem; color: #f0f4ff; }
        .feature-card p { font-size: 0.9rem; color: #6b7280; line-height: 1.6; }

        .how-it-works {
          max-width: 1000px;
          margin: 0 auto;
          padding: 4rem 2rem;
          text-align: center;
        }
        .how-it-works h2 {
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 3rem;
          color: #f0f4ff;
        }
        .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; }
        .step { text-align: left; }
        .step-num {
          display: block;
          font-size: 3rem;
          font-weight: 900;
          color: rgba(74,222,128,0.15);
          line-height: 1;
          margin-bottom: 1rem;
          letter-spacing: -0.05em;
        }
        .step h4 { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: #e8eaf0; }
        .step p { font-size: 0.85rem; color: #6b7280; line-height: 1.6; }

        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2rem 4rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          color: #374151;
          font-size: 0.82rem;
        }
        .footer-stack { color: #1f2937; }

        @media (max-width: 768px) {
          .nav { padding: 1rem 1.5rem; }
          .features { grid-template-columns: 1fr; }
          .steps { grid-template-columns: repeat(2, 1fr); }
          .footer { flex-direction: column; gap: 0.5rem; padding: 1.5rem; }
          .hero-stats { flex-direction: column; gap: 1.5rem; }
          .stat-divider { width: 60px; height: 1px; }
        }
      `}</style>
    </main>
  );
}
