import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClaimDTO, CarDTO, ApiResponse } from '@/types';

// ── useCars ───────────────────────────────────────────────────────────────────

export function useCars() {
  const [cars, setCars] = useState<CarDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cars');
      const data: ApiResponse<CarDTO[]> = await res.json();
      if (data.success) setCars(data.data);
      else setError(data.error.message);
    } catch {
      setError('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  const addCar = useCallback(async (car: Omit<CarDTO, '_id' | 'createdAt'>) => {
    const res = await fetch('/api/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(car),
    });
    const data: ApiResponse<CarDTO> = await res.json();
    if (data.success) {
      setCars(prev => [data.data, ...prev]);
      return data.data;
    }
    throw new Error(data.error.message);
  }, []);

  const deleteCar = useCallback(async (id: string) => {
    const res = await fetch(`/api/cars/${id}`, { method: 'DELETE' });
    const data: ApiResponse = await res.json();
    if (data.success) setCars(prev => prev.filter(c => c._id !== id));
    else throw new Error(data.error.message);
  }, []);

  return { cars, loading, error, refetch: fetchCars, addCar, deleteCar };
}

// ── useClaim (with polling) ───────────────────────────────────────────────────

interface UseClaimOptions {
  pollInterval?: number; // ms, default 3000
}

export function useClaim(claimId: string, options: UseClaimOptions = {}) {
  const { pollInterval = 3000 } = options;
  const [claim, setClaim] = useState<ClaimDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchClaim = useCallback(async () => {
    try {
      const res = await fetch(`/api/claims/${claimId}`);
      const data: ApiResponse<ClaimDTO> = await res.json();
      if (data.success) {
        setClaim(data.data);
        return data.data.status;
      } else {
        setError(data.error.message);
        return null;
      }
    } catch {
      setError('Failed to load claim');
      return null;
    }
  }, [claimId]);

  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      const status = await fetchClaim();
      if (active) setLoading(false);

      // Start polling for non-terminal statuses
      if (status === 'queued' || status === 'processing') {
        intervalRef.current = setInterval(async () => {
          const s = await fetchClaim();
          if (s === 'completed' || s === 'failed' || !active) {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        }, pollInterval);
      }
    }

    init();

    return () => {
      active = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [claimId, fetchClaim, pollInterval]);

  const retry = useCallback(async () => {
    const res = await fetch(`/api/claims/${claimId}`, { method: 'POST' });
    const data: ApiResponse = await res.json();
    if (data.success) {
      setClaim(prev => prev ? { ...prev, status: 'queued' } : prev);
      // Re-start polling
      intervalRef.current = setInterval(async () => {
        const s = await fetchClaim();
        if (s === 'completed' || s === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, pollInterval);
    } else {
      throw new Error(data.error.message);
    }
  }, [claimId, fetchClaim, pollInterval]);

  return { claim, loading, error, refetch: fetchClaim, retry };
}

// ── useClaims (paginated list) ────────────────────────────────────────────────

interface UseClaimsOptions {
  limit?: number;
  status?: string;
}

export function useClaims(options: UseClaimsOptions = {}) {
  const { limit = 10, status = 'all' } = options;
  const [claims, setClaims] = useState<ClaimDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchClaims = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const statusParam = status !== 'all' ? `&status=${status}` : '';
      const res = await fetch(`/api/claims?page=${p}&limit=${limit}${statusParam}`);
      const data: ApiResponse<ClaimDTO[]> = await res.json();
      if (data.success) {
        setClaims(data.data);
        if (data.meta?.pagination) {
          setTotalPages(data.meta.pagination.pages);
          setTotal(data.meta.pagination.total);
        }
      } else {
        setError(data.error.message);
      }
    } catch {
      setError('Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [limit, status]);

  useEffect(() => {
    fetchClaims(page);
  }, [fetchClaims, page]);

  return {
    claims, loading, error, page, totalPages, total,
    setPage, refetch: () => fetchClaims(page),
  };
}
