import type { Metadata } from 'next';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';

// Auth (HTTP Basic) is enforced in middleware.ts, not here.

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--admin-bg)',
        color: 'var(--admin-text)',
        fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
      }}
    >
      <AdminSidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          marginLeft: 'var(--admin-sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <AdminHeader notificationCount={0} />
        {/* SiteChrome skips its own <main> on /admin routes, so this is the only <main>. */}
        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
}
