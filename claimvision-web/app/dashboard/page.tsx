import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/connect';
import Claim from '@/models/Claim';
import Car from '@/models/Car';
import User from '@/models/User';
import Link from 'next/link';
import { VehicleIcon } from '@/components/icons/VehicleIcon';
import styles from './page.module.css';
import { displayInrCostLabel } from '@/lib/currency/inr';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login');

  await connectDB();

  // `Claim.userId` expects a Mongo ObjectId (string form).
  // Credentials sign-in sets `session.user.id` correctly, but Google OAuth may set it to a provider id,
  // so we validate the id and fall back to a lookup via email.
  const userIdCandidate: unknown = (session.user as any).id;
  const isValidObjectId = (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

  // Prefer resolving from DB by email (works for both credentials + Google OAuth).
  let userId: string | undefined;
  if (session.user.email) {
    const dbUser = await User.findOne({ email: session.user.email.toLowerCase() })
      .select('_id')
      .lean();
    const resolved = dbUser?._id?.toString();
    userId = isValidObjectId(resolved) ? resolved : undefined;
  }

  // If email lookup fails (or email isn't present), resolve via Google provider id.
  // This covers the case where `session.user.id` is the OAuth provider id (not our Mongo _id).
  if (!userId && typeof userIdCandidate === 'string' && userIdCandidate) {
    const dbUserByProvider = await User.findOne({
      provider: 'google',
      providerId: userIdCandidate,
    })
      .select('_id')
      .lean();
    const resolved = dbUserByProvider?._id?.toString();
    userId = isValidObjectId(resolved) ? resolved : undefined;

    if (!userId) {
      const dbUserByAnyProvider = await User.findOne({
        providerId: userIdCandidate,
      })
        .select('_id')
        .lean();
      const resolvedAny = dbUserByAnyProvider?._id?.toString();
      userId = isValidObjectId(resolvedAny) ? resolvedAny : undefined;
    }
  }

  // Fallback to session.user.id if it looks like a real ObjectId.
  if (!userId) {
    userId = isValidObjectId(userIdCandidate) ? userIdCandidate : undefined;
  }

  if (!userId) redirect('/auth/login');

  const [totalClaims, completedClaims, failedClaims, recentClaims, totalCars] = await Promise.all([
    Claim.countDocuments({ userId }),
    Claim.countDocuments({ userId, status: 'completed' }),
    Claim.countDocuments({ userId, status: 'failed' }),
    Claim.find({ userId })
      .populate('carId', 'brand model year')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Car.countDocuments({ userId }),
  ]);

  const processingClaims = totalClaims - completedClaims - failedClaims;

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back, {(session.user.name ?? session.user.email ?? 'there').split(' ')[0]}
          </p>
        </div>
        <Link href="/dashboard/new-claim" className={styles.btnNew}>
          <span>+</span> New Claim
        </Link>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Claims</span>
          <span className={styles.statValue}>{totalClaims}</span>
          <span className={styles.statSub}>{totalCars} vehicle{totalCars !== 1 ? 's' : ''} registered</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardGreen}`}>
          <span className={styles.statLabel}>Completed</span>
          <span className={`${styles.statValue} ${styles.statValueGreen}`}>{completedClaims}</span>
          <span className={styles.statSub}>{totalClaims > 0 ? Math.round((completedClaims / totalClaims) * 100) : 0}% success rate</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardYellow}`}>
          <span className={styles.statLabel}>Processing</span>
          <span className={`${styles.statValue} ${styles.statValueYellow}`}>{processingClaims}</span>
          <span className={styles.statSub}>In queue or analyzing</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardRed}`}>
          <span className={styles.statLabel}>Failed</span>
          <span className={`${styles.statValue} ${styles.statValueRed}`}>{failedClaims}</span>
          <span className={styles.statSub}>Eligible for retry</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Claims</h2>
          <Link href="/dashboard/claims" className={styles.linkAll}>View all →</Link>
        </div>

        {recentClaims.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>◎</span>
            <p>No claims yet</p>
            <Link href="/dashboard/new-claim" className={styles.btnNewSm}>Submit your first claim</Link>
          </div>
        ) : (
          <div className={styles.claimsList}>
            {recentClaims.map((claim: any) => (
              <Link href={`/dashboard/claims/${claim._id}`} key={claim._id.toString()} className={styles.claimRow}>
                <div className={styles.claimCar}>
                  <VehicleIcon className={styles.carIconSvg} size={22} />
                  <div>
                    <span className={styles.carName}>
                      {claim.carId?.year} {claim.carId?.brand} {claim.carId?.model}
                    </span>
                    <span className={styles.claimDate}>
                      {new Date(claim.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {claim.llmResponse && (
                  <span className={styles.claimCost}>
                    {displayInrCostLabel(claim.llmResponse.estimatedCostRange)}
                  </span>
                )}

                <StatusBadge status={claim.status} />
                <span className={styles.claimArrow}>→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
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
      display: 'inline-block',
      padding: '0.25rem 0.6rem',
      borderRadius: '6px',
      background: `${color}18`,
      color,
      fontSize: '0.75rem',
      fontWeight: 700,
      border: `1px solid ${color}30`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
