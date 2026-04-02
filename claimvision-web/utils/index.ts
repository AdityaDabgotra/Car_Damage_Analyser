// ── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', options ?? {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Number formatting ────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

// ── File validation ──────────────────────────────────────────────────────────

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/avi', 'video/webm', 'video/x-msvideo'];
  const maxSizeMB = 100;

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please upload MP4, MOV, AVI, or WebM.' };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB.` };
  }
  return { valid: true };
}

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = reject;
    video.src = URL.createObjectURL(file);
  });
}

// ── String utilities ─────────────────────────────────────────────────────────

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str;
}

// ── Severity / urgency color maps ─────────────────────────────────────────────

export const SEVERITY_COLORS: Record<string, string> = {
  low: '#4ade80',
  medium: '#fbbf24',
  high: '#f97316',
  critical: '#f87171',
};

export const ACTION_COLORS: Record<string, string> = {
  repair: '#fbbf24',
  replace: '#f87171',
  monitor: '#60a5fa',
};

export const STATUS_COLORS: Record<string, string> = {
  queued: '#6b7280',
  processing: '#fbbf24',
  completed: '#4ade80',
  failed: '#f87171',
};

export function getSeverityColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? '#6b7280';
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#6b7280';
}
