import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#f5f5f5', color: '#1C2230' }}>
      <div
        style={{
          background: '#1C2230',
          color: '#F6F1E8',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <span style={{ fontWeight: 600, letterSpacing: '0.1em', fontSize: '14px' }}>VELLEE LUXE — ADMIN</span>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', fontSize: '13px' }}>
          <a href="/admin" style={{ color: '#B8B0A4', textDecoration: 'none' }}>Dashboard</a>
          <a href="/admin/orders" style={{ color: '#B8B0A4', textDecoration: 'none' }}>Orders</a>
          <a href="/admin/returns" style={{ color: '#B8B0A4', textDecoration: 'none' }}>Returns</a>
          <a href="/admin/store-credit" style={{ color: '#B8B0A4', textDecoration: 'none' }}>Store Credit</a>
          <a href="/admin/suppliers" style={{ color: '#B8B0A4', textDecoration: 'none' }}>Suppliers</a>
          <a href="/admin/settings" style={{ color: '#B8B0A4', textDecoration: 'none' }}>Settings</a>
        </nav>
      </div>
      {/* A <div>, not <main>: the root layout already wraps every page in <main>. */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>{children}</div>
    </div>
  );
}
