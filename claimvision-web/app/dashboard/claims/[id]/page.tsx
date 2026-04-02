'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { CVResponseType } from '@/lib/validators/schemas';
import {
  CV_ASSESSMENT_STYLE,
  cvAffectedCount,
  cvPartsSorted,
  formatCvPartLabel,
} from '@/lib/cv/cvDisplay';
import { displayInrCostLabel, formatInrRange } from '@/lib/currency/inr';

interface Recommendation {
  part: string;
  action: 'repair' | 'replace' | 'monitor';
  reason: string;
  estimatedCost?: { min: number; max: number; currency: string };
}

interface ClaimData {
  _id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  videoUrl: string;
  errorMessage?: string;
  attemptCount: number;
  carId: { brand: string; model: string; year: number; color?: string; licensePlate?: string };
  cvResponse?: CVResponseType;
  llmResponse?: {
    recommendations: Recommendation[];
    estimatedCostRange: string;
    summary: string;
    urgency: string;
    totalEstimatedMin?: number;
    totalEstimatedMax?: number;
  };
}

const ACTION_CONFIG: Record<string, { color: string; icon: string }> = {
  repair: { color: '#fbbf24', icon: '🔧' },
  replace: { color: '#f87171', icon: '🔄' },
  monitor: { color: '#60a5fa', icon: '👁' },
};

const showroomStorageKey = (claimId: string) => `claimvision-showroom-offer-${claimId}`;

export default function ClaimDetailPage() {
  const { id } = useParams() as { id: string };
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultLoading, setConsultLoading] = useState(false);
  const [consultError, setConsultError] = useState('');
  const [consultSentBanner, setConsultSentBanner] = useState(false);
  /** Offset from center while dragging the showroom dialog (px). */
  const [showroomOffset, setShowroomOffset] = useState({ x: 0, y: 0 });

  async function fetchClaim() {
    const res = await fetch(`/api/claims/${id}`);
    const data = await res.json();
    if (data.success) {
      setClaim(data.data);
      return data.data.status;
    }
    setError('Failed to load claim');
    return null;
  }

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function init() {
      setLoading(true);
      const status = await fetchClaim();
      setLoading(false);

      if (status === 'queued' || status === 'processing') {
        interval = setInterval(async () => {
          const s = await fetchClaim();
          if (s === 'completed' || s === 'failed') clearInterval(interval);
        }, 3000);
      }
    }

    init();
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (claim?.status !== 'completed' || !claim.llmResponse) return;
    try {
      const prev = localStorage.getItem(showroomStorageKey(id));
      if (!prev) setShowConsultModal(true);
    } catch {
      setShowConsultModal(true);
    }
  }, [claim?.status, claim?.llmResponse, id]);

  useEffect(() => {
    if (showConsultModal) setShowroomOffset({ x: 0, y: 0 });
  }, [showConsultModal]);

  function startShowroomDrag(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = showroomOffset.x;
    const oy = showroomOffset.y;
    function move(ev: MouseEvent) {
      setShowroomOffset({ x: ox + ev.clientX - startX, y: oy + ev.clientY - startY });
    }
    function up() {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function dismissShowroomNo() {
    try {
      localStorage.setItem(showroomStorageKey(id), 'dismissed');
    } catch {
      /* ignore */
    }
    setShowConsultModal(false);
    setConsultError('');
  }

  async function submitShowroomYes() {
    setConsultError('');
    setConsultLoading(true);
    try {
      const res = await fetch(`/api/claims/${id}/showroom-consult`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setConsultError(data.error?.message ?? 'Could not reach showroom service');
        setConsultLoading(false);
        return;
      }
      try {
        localStorage.setItem(showroomStorageKey(id), 'sent');
      } catch {
        /* ignore */
      }
      setShowConsultModal(false);
      setConsultSentBanner(true);
    } catch {
      setConsultError('Something went wrong. Please try again.');
    }
    setConsultLoading(false);
  }

  async function handleRetry() {
    setRetrying(true);
    const res = await fetch(`/api/claims/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setClaim(prev => prev ? { ...prev, status: 'queued' } : prev);
      // Start polling again
      const interval = setInterval(async () => {
        const s = await fetchClaim();
        if (s === 'completed' || s === 'failed') clearInterval(interval);
      }, 3000);
    }
    setRetrying(false);
  }

  if (loading) return (
    <div className="loading-state">
      <div className="pulse-ring" />
      <p>Loading claim...</p>
    </div>
  );

  if (error || !claim) return (
    <div className="error-state">
      <p>{error || 'Claim not found'}</p>
      <Link href="/dashboard/claims">← Back to claims</Link>
    </div>
  );

  const isProcessing = claim.status === 'queued' || claim.status === 'processing';
  const urgencyColor = { low: '#4ade80', medium: '#fbbf24', high: '#f97316', critical: '#f87171' }[claim.llmResponse?.urgency ?? 'low'];

  return (
    <div className="claim-detail">
      <div className="detail-header">
        <Link href="/dashboard/claims" className="back-link">← Claims</Link>
        <div className="header-row">
          <div>
            <h1>
              {claim.carId.year} {claim.carId.brand} {claim.carId.model}
            </h1>
            <p className="claim-meta">
              Submitted {new Date(claim.createdAt).toLocaleString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <StatusBadge status={claim.status} />
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="processing-card">
          <div className="processing-animation">
            <div className="scan-ring" />
            <span className="scan-icon">◈</span>
          </div>
          <div>
            <h2>AI Analysis in Progress</h2>
            <p>
              {claim.status === 'queued'
                ? 'Your video is queued for analysis...'
                : 'Computer vision scanning your video for damage patterns...'}
            </p>
          </div>
        </div>
      )}

      {/* Failed State */}
      {claim.status === 'failed' && (
        <div className="failed-card">
          <span className="failed-icon">⚠</span>
          <div>
            <h3>Analysis Failed</h3>
            <p>{claim.errorMessage ?? 'An unexpected error occurred during analysis.'}</p>
          </div>
          {claim.attemptCount < 5 && (
            <button className="btn-retry" onClick={handleRetry} disabled={retrying}>
              {retrying ? 'Retrying...' : '↺ Retry Analysis'}
            </button>
          )}
        </div>
      )}

      {/* Completed Results */}
      {claim.status === 'completed' && claim.llmResponse && (
        <>
          {/* Summary Banner */}
          <div className="summary-banner">
            <div className="summary-text">
              <div className="urgency-tag" style={{ background: `${urgencyColor}15`, color: urgencyColor, borderColor: `${urgencyColor}30` }}>
                {claim.llmResponse.urgency.toUpperCase()} URGENCY
              </div>
              <p>{claim.llmResponse.summary}</p>
            </div>
            <div className="cost-estimate">
              <span className="cost-label">Estimated Cost</span>
              <span className="cost-value">{displayInrCostLabel(claim.llmResponse.estimatedCostRange)}</span>
            </div>
          </div>

          <div className="results-grid">
            {/* CV Detections */}
            {claim.cvResponse && (
              <div className="results-section">
                <h2>
                  CV assessment (per region)
                  <span className="count-badge">{cvAffectedCount(claim.cvResponse)}</span>
                </h2>
                <p className="cv-hint">
                  Per-region CV output. Areas needing work are listed first; others follow as &quot;No Damage&quot;.
                </p>
                <div className="detections-list">
                  {cvPartsSorted(claim.cvResponse).map(({ key, assessment }) => {
                    const st = CV_ASSESSMENT_STYLE[assessment];
                    return (
                      <div key={key} className="detection-item">
                        <div className="detection-left">
                          <span className="detection-part">{formatCvPartLabel(key)}</span>
                        </div>
                        <div className="detection-right">
                          <span
                            className="cv-assessment-tag"
                            style={{
                              color: st.color,
                              background: `${st.color}15`,
                              borderColor: st.border,
                            }}
                          >
                            {assessment}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Recommendations */}
            <div className="results-section">
              <h2>AI Recommendations</h2>
              <div className="recs-list">
                {claim.llmResponse.recommendations.map((rec, i) => {
                  const cfg = ACTION_CONFIG[rec.action];
                  return (
                    <div key={i} className="rec-item">
                      <div className="rec-header">
                        <span className="rec-icon">{cfg.icon}</span>
                        <span className="rec-part">{rec.part}</span>
                        <span
                          className="rec-action"
                          style={{ color: cfg.color, background: `${cfg.color}15`, borderColor: `${cfg.color}30` }}
                        >
                          {rec.action.toUpperCase()}
                        </span>
                      </div>
                      <p className="rec-reason">{rec.reason}</p>
                      {rec.estimatedCost && (
                        <span className="rec-cost">
                          {formatInrRange(rec.estimatedCost.min, rec.estimatedCost.max)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {consultSentBanner && (
            <div className="showroom-sent-banner" role="status">
              Your details were shared with the showroom team. They may contact you using the phone and email on your account.
            </div>
          )}

          {showConsultModal && (
            <div
              className="showroom-dialog"
              role="dialog"
              aria-modal="false"
              aria-labelledby="showroom-dialog-title"
              style={{
                transform: `translate(calc(-50% + ${showroomOffset.x}px), calc(-50% + ${showroomOffset.y}px))`,
              }}
            >
              <div
                className="showroom-drag-handle"
                onMouseDown={startShowroomDrag}
                title="Drag to move"
              >
                <span className="showroom-drag-grip" aria-hidden />
                <span className="showroom-drag-label">Drag to move</span>
              </div>
              <div className="showroom-dialog-body">
                <h2 id="showroom-dialog-title">Consult at the showroom?</h2>
                <p>
                  Would you like our showroom to review this estimate and follow up with you about repairs or next steps?
                </p>
                {consultError && <div className="showroom-dialog-error">{consultError}</div>}
                <div className="showroom-dialog-actions">
                  <button
                    type="button"
                    className="btn-showroom-no"
                    onClick={dismissShowroomNo}
                    disabled={consultLoading}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="btn-showroom-yes"
                    onClick={submitShowroomYes}
                    disabled={consultLoading}
                  >
                    {consultLoading ? 'Sending…' : 'Yes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Video */}
      {claim.videoUrl && (
        <div className="video-section">
          <h2>Uploaded Video</h2>
          <video src={claim.videoUrl} controls className="claim-video" />
        </div>
      )}

      <style jsx>{`
        .claim-detail { max-width: 900px; display: flex; flex-direction: column; gap: 1.5rem; }
        .back-link { color: #6b7280; font-size: 0.85rem; text-decoration: none; display: inline-block; margin-bottom: 0.75rem; }
        .back-link:hover { color: #4ade80; }
        .header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
        h1 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; color: #f0f4ff; }
        .claim-meta { font-size: 0.82rem; color: #6b7280; margin-top: 0.25rem; }

        .loading-state, .error-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem; color: #6b7280; }
        .pulse-ring { width: 48px; height: 48px; border: 3px solid rgba(74,222,128,0.3); border-top-color: #4ade80; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .processing-card {
          display: flex; align-items: center; gap: 1.5rem;
          background: rgba(74,222,128,0.04); border: 1px solid rgba(74,222,128,0.15);
          border-radius: 14px; padding: 2rem;
        }
        .processing-animation { position: relative; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .scan-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 2px solid rgba(74,222,128,0.3); border-top-color: #4ade80;
          animation: spin 1.5s linear infinite;
        }
        .scan-icon { color: #4ade80; font-size: 1.4rem; }
        .processing-card h2 { font-size: 1.05rem; font-weight: 700; color: #f0f4ff; margin-bottom: 0.3rem; }
        .processing-card p { font-size: 0.85rem; color: #6b7280; }

        .failed-card {
          display: flex; align-items: center; gap: 1rem;
          background: rgba(248,113,113,0.05); border: 1px solid rgba(248,113,113,0.2);
          border-radius: 12px; padding: 1.5rem;
        }
        .failed-icon { font-size: 1.5rem; color: #f87171; }
        .failed-card h3 { font-size: 0.95rem; font-weight: 700; color: #f0f4ff; margin-bottom: 0.2rem; }
        .failed-card p { font-size: 0.83rem; color: #9ca3af; }
        .btn-retry { margin-left: auto; padding: 0.5rem 1rem; border-radius: 7px; background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2); font-size: 0.83rem; cursor: pointer; white-space: nowrap; }

        .summary-banner {
          display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem;
          background: #0d1117; border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px; padding: 1.75rem;
        }
        .summary-text { flex: 1; display: flex; flex-direction: column; gap: 0.75rem; }
        .urgency-tag { display: inline-block; padding: 0.25rem 0.65rem; border-radius: 6px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; border: 1px solid; width: fit-content; }
        .summary-text p { font-size: 0.9rem; color: #9ca3af; line-height: 1.6; }
        .cost-estimate { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; }
        .cost-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; }
        .cost-value { font-size: 1.4rem; font-weight: 800; color: #f0f4ff; letter-spacing: -0.02em; white-space: nowrap; }

        .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
        .results-section { background: #0d1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.5rem; }
        .results-section h2 { font-size: 0.9rem; font-weight: 700; color: #f0f4ff; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        .count-badge { background: rgba(74,222,128,0.1); color: #4ade80; font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 100px; }
        .cv-hint { font-size: 0.78rem; color: #6b7280; margin: -0.5rem 0 0.85rem; line-height: 1.4; }

        .detections-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .detection-item { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); }
        .detection-left { display: flex; flex-direction: column; gap: 0.15rem; }
        .detection-part { font-size: 0.88rem; font-weight: 600; color: #e8eaf0; text-transform: capitalize; }
        .detection-loc { font-size: 0.72rem; color: #6b7280; }
        .detection-right { display: flex; align-items: center; gap: 0.5rem; }
        .cv-assessment-tag { padding: 0.2rem 0.5rem; border-radius: 5px; font-size: 0.72rem; font-weight: 600; border: 1px solid; }

        .recs-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .rec-item { padding: 0.85rem; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); }
        .rec-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .rec-icon { font-size: 0.9rem; }
        .rec-part { flex: 1; font-size: 0.88rem; font-weight: 600; color: #e8eaf0; text-transform: capitalize; }
        .rec-action { padding: 0.2rem 0.5rem; border-radius: 5px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em; border: 1px solid; }
        .rec-reason { font-size: 0.78rem; color: #6b7280; line-height: 1.5; margin-bottom: 0.4rem; }
        .rec-cost { font-size: 0.78rem; color: #9ca3af; font-family: 'DM Mono', monospace; }

        .video-section { background: #0d1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.5rem; }
        .video-section h2 { font-size: 0.9rem; font-weight: 700; color: #f0f4ff; margin-bottom: 1rem; }
        .claim-video { width: 100%; border-radius: 8px; max-height: 320px; background: #000; }

        .showroom-sent-banner {
          padding: 1rem 1.25rem;
          border-radius: 12px;
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.25);
          color: #a7f3d0;
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .showroom-dialog {
          position: fixed;
          left: 50%;
          top: 50%;
          z-index: 100;
          width: calc(100% - 2rem);
          max-width: 420px;
          background: #0d1117;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 0;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
          pointer-events: auto;
        }

        .showroom-drag-handle {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.65rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px 16px 0 0;
          cursor: grab;
          user-select: none;
          touch-action: none;
        }

        .showroom-drag-handle:active {
          cursor: grabbing;
        }

        .showroom-drag-grip {
          width: 1.1rem;
          height: 0.35rem;
          border-radius: 2px;
          background: repeating-linear-gradient(
            90deg,
            #6b7280 0 3px,
            transparent 3px 6px
          );
          opacity: 0.85;
        }

        .showroom-drag-label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #6b7280;
        }

        .showroom-dialog-body {
          padding: 1.25rem 1.75rem 1.75rem;
        }

        .showroom-dialog-body h2 {
          font-size: 1.15rem;
          font-weight: 800;
          color: #f0f4ff;
          margin-bottom: 0.65rem;
          letter-spacing: -0.02em;
        }

        .showroom-dialog-body p {
          font-size: 0.88rem;
          color: #9ca3af;
          line-height: 1.55;
          margin-bottom: 1.25rem;
        }

        .showroom-dialog-error {
          font-size: 0.82rem;
          color: #f87171;
          margin-bottom: 1rem;
          padding: 0.65rem 0.85rem;
          border-radius: 8px;
          background: rgba(248, 113, 113, 0.08);
          border: 1px solid rgba(248, 113, 113, 0.2);
        }

        .showroom-dialog-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .btn-showroom-no {
          padding: 0.65rem 1.25rem;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: transparent;
          color: #9ca3af;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-showroom-no:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: #e8eaf0;
        }

        .btn-showroom-yes {
          padding: 0.65rem 1.35rem;
          border-radius: 10px;
          border: none;
          background: #4ade80;
          color: #080a0f;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-showroom-yes:hover:not(:disabled) {
          background: #86efac;
        }

        .btn-showroom-no:disabled,
        .btn-showroom-yes:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .results-grid { grid-template-columns: 1fr; }
          .summary-banner { flex-direction: column; }
          .cost-estimate { align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    queued: { color: '#6b7280', label: 'Queued' },
    processing: { color: '#fbbf24', label: 'Analyzing' },
    completed: { color: '#4ade80', label: 'Completed' },
    failed: { color: '#f87171', label: 'Failed' },
  };
  const { color, label } = config[status] ?? { color: '#6b7280', label: status };
  return (
    <span style={{
      padding: '0.35rem 0.8rem', borderRadius: '7px',
      background: `${color}15`, color, fontSize: '0.8rem',
      fontWeight: 700, border: `1px solid ${color}30`, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
