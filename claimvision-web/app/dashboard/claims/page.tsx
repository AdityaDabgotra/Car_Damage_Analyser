'use client';

import { VehicleIcon } from '@/components/icons/VehicleIcon';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CVResponseType } from '@/lib/validators/schemas';
import { CV_ASSESSMENT_STYLE, cvAffectedParts, formatCvPartLabel } from '@/lib/cv/cvDisplay';
import { displayInrCostLabel } from '@/lib/currency/inr';

interface Claim {
  _id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  carId: { brand: string; model: string; year: number };
  llmResponse?: { estimatedCostRange: string; urgency: string; summary: string };
  cvResponse?: CVResponseType;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    const statusParam = filter !== 'all' ? `&status=${filter}` : '';
    fetch(`/api/claims?page=${page}&limit=10${statusParam}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setClaims(d.data);
          setTotalPages(d.meta?.pagination?.pages ?? 1);
        }
      })
      .finally(() => setLoading(false));
  }, [filter, page]);

  return (
    <div className="claims-page">
      <div className="page-header">
        <div>
          <h1>Claim History</h1>
          <p>All your vehicle damage assessments</p>
        </div>
        <Link href="/dashboard/new-claim" className="btn-new">+ New Claim</Link>
      </div>

      <div className="filters">
        {['all', 'completed', 'processing', 'queued', 'failed'].map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'filter-btn--active' : ''}`}
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-rows">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      ) : claims.length === 0 ? (
        <div className="empty">
          <span>◎</span>
          <p>No claims found</p>
          <Link href="/dashboard/new-claim">Submit your first claim →</Link>
        </div>
      ) : (
        <div className="claims-table">
          <div className="table-header">
            <span>Vehicle</span>
            <span>Damages</span>
            <span>Cost Estimate</span>
            <span>Date</span>
            <span>Status</span>
          </div>
          {claims.map((claim) => {
            const cv = claim.cvResponse;
            const affected = cv ? cvAffectedParts(cv) : [];
            const damageChips = affected.slice(0, 3);
            return (
            <Link key={claim._id} href={`/dashboard/claims/${claim._id}`} className="table-row">
              <div className="cell-vehicle">
                <VehicleIcon className="vehicle-table-icon" size={22} />
                <div className="vehicle-name-row">
                  <span className="vehicle-name">
                    {claim.carId?.year} {claim.carId?.brand} {claim.carId?.model}
                  </span>
                  {claim.llmResponse?.urgency && (
                    <span className="urgency-dot" style={{
                      background: { low: '#4ade80', medium: '#fbbf24', high: '#f97316', critical: '#f87171' }[claim.llmResponse.urgency] ?? '#6b7280'
                    }} />
                  )}
                </div>
              </div>
              <div className="cell-damages">
                {cv ? (
                  <>
                    {damageChips.map((key) => {
                      const a = cv[key];
                      const st = CV_ASSESSMENT_STYLE[a];
                      return (
                        <span
                          key={key}
                          className="damage-chip"
                          style={{ borderColor: st.border, color: st.color }}
                        >
                          {formatCvPartLabel(key)}
                        </span>
                      );
                    })}
                    {affected.length > 3 && (
                      <span className="damage-more">+{affected.length - 3}</span>
                    )}
                  </>
                ) : (
                  <span className="cell-na">—</span>
                )}
              </div>
              <span className="cell-cost">
                {claim.llmResponse?.estimatedCostRange
                  ? displayInrCostLabel(claim.llmResponse.estimatedCostRange)
                  : '—'}
              </span>
              <span className="cell-date">
                {new Date(claim.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <StatusBadge status={claim.status} />
            </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="page-btn">← Prev</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="page-btn">Next →</button>
        </div>
      )}

      <style jsx>{`
        .claims-page { max-width: 1000px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.75rem; }
        h1 { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.03em; color: #f0f4ff; margin-bottom: 0.25rem; }
        .page-header p { color: #6b7280; font-size: 0.9rem; }
        .btn-new { padding: 0.6rem 1.2rem; background: #4ade80; color: #080a0f; border-radius: 8px; font-weight: 700; font-size: 0.85rem; text-decoration: none; white-space: nowrap; }

        .filters { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .filter-btn { padding: 0.4rem 0.9rem; border-radius: 7px; font-size: 0.82rem; font-weight: 500; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: #6b7280; cursor: pointer; transition: all 0.15s; }
        .filter-btn:hover { color: #e8eaf0; border-color: rgba(255,255,255,0.15); }
        .filter-btn--active { background: rgba(74,222,128,0.1); color: #4ade80; border-color: rgba(74,222,128,0.25); }

        .loading-rows { display: flex; flex-direction: column; gap: 0.5rem; }
        .skeleton-row { height: 62px; border-radius: 10px; background: linear-gradient(90deg, #0d1117 0%, #161b22 50%, #0d1117 100%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .empty { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 4rem; text-align: center; }
        .empty span { font-size: 2.5rem; color: #374151; }
        .empty p { color: #6b7280; }
        .empty a { color: #4ade80; font-size: 0.88rem; text-decoration: none; }

        .claims-table { display: flex; flex-direction: column; gap: 0.4rem; }
        .table-header {
          display: grid; grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr;
          padding: 0.5rem 1.25rem; font-size: 0.72rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em; color: #4b5563;
        }
        .table-row {
          display: grid; grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr;
          align-items: center; gap: 0.5rem;
          padding: 1rem 1.25rem;
          background: #0d1117; border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; text-decoration: none; transition: all 0.15s;
        }
        .table-row:hover { border-color: rgba(74,222,128,0.2); transform: translateX(2px); }

        .cell-vehicle { display: flex; flex-direction: column; align-items: flex-start; gap: 0.4rem; }
        .vehicle-table-icon { color: #4ade80; flex-shrink: 0; }
        .vehicle-name-row { display: flex; align-items: center; gap: 0.45rem; }
        .vehicle-name { font-size: 0.88rem; font-weight: 600; color: #4ade80; }
        .urgency-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        .cell-damages { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
        .damage-chip { font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 5px; border: 1px solid; background: transparent; text-transform: capitalize; }
        .damage-more { font-size: 0.72rem; color: #6b7280; }
        .cell-na { color: #374151; font-size: 0.85rem; }

        .cell-cost { font-size: 0.82rem; color: #9ca3af; font-family: 'DM Mono', monospace; }
        .cell-date { font-size: 0.8rem; color: #6b7280; }

        .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
        .page-btn { padding: 0.5rem 1rem; border-radius: 7px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: #9ca3af; font-size: 0.83rem; cursor: pointer; }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-info { font-size: 0.82rem; color: #6b7280; }

        @media (max-width: 768px) {
          .table-header { display: none; }
          .table-row { grid-template-columns: 1fr auto; grid-template-rows: auto auto; }
          .cell-damages, .cell-cost, .cell-date { display: none; }
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
    <span style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', background: `${color}15`, color, fontSize: '0.75rem', fontWeight: 700, border: `1px solid ${color}30`, width: 'fit-content' }}>
      {label}
    </span>
  );
}
