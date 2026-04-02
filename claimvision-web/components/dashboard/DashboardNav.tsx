'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import styles from './DashboardNav.module.css';

interface Props {
  user: { name?: string; email?: string; image?: string; role?: string };
}

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '◈' },
  { href: '/dashboard/new-claim', label: 'New Claim', icon: '⊕' },
  { href: '/dashboard/claims', label: 'Claim History', icon: '≡' },
  { href: '/dashboard/profile', label: 'Profile', icon: '◎' },
];

export default function DashboardNav({ user }: Props) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarLogo}>
        <span className={styles.logoMark} aria-hidden>
          ◈
        </span>
        <span>ClaimVision</span>
      </div>

      <nav className={styles.navSection} aria-label="Dashboard">
        <span className={styles.navSectionLabel}>Menu</span>
        {navItems.map((item) => {
          const active =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIconWrap} aria-hidden>
                {item.icon}
              </span>
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar} aria-hidden>
            {user.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className={styles.userMeta}>
            <span className={styles.userName}>{user.name ?? 'User'}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </div>
        <button
          type="button"
          className={styles.btnSignout}
          onClick={() => signOut({ callbackUrl: '/' })}
          title="Sign out"
          aria-label="Sign out"
        >
          ⇥
        </button>
      </div>
    </aside>
  );
}
