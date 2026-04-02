import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/config';
import DashboardNav from '@/components/dashboard/DashboardNav';
import styles from './layout.module.css';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/login');
  if (!session.user.phoneComplete) redirect('/onboarding/phone');

  return (
    <div className={styles.dashboardShell}>
      <DashboardNav user={session.user as any} />
      <main className={styles.dashboardMain}>{children}</main>
    </div>
  );
}
