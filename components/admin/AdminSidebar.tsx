'use client';

/**
 * AdminSidebar — fixed left navigation for the admin panel.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type NavItem = { label: string; href: string };
type NavGroup = {
  title: string;
  items: (NavItem | { label: string; children: NavItem[] })[];
};

const CATALOG_ROOT = '/admin/catalog';

const CATALOG_CHILDREN: NavItem[] = [
  { label: 'Products', href: '/admin/catalog' },
  { label: 'Families', href: '/admin/catalog/families' },
  { label: 'Inventory', href: '/admin/catalog/inventory' },
];

const NAV: NavGroup[] = [
  {
    title: 'Main',
    items: [{ label: 'Overview', href: '/admin' }, { label: 'Catalog', children: CATALOG_CHILDREN }],
  },
  {
    title: 'Commerce',
    items: [
      { label: 'Orders', href: '/admin/orders' },
      { label: 'Customers', href: '/admin/customers' },
      { label: 'Returns', href: '/admin/returns' },
      { label: 'Store Credit', href: '/admin/store-credit' },
      { label: 'Discount Codes', href: '/admin/discount-codes' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Suppliers', href: '/admin/suppliers' },
      { label: 'Notifications', href: '/admin/notifications' },
    ],
  },
  {
    title: 'Marketing',
    items: [{ label: 'Email Templates', href: '/admin/email-templates' }],
  },
  {
    title: 'System',
    items: [
      { label: 'Analytics', href: '/admin/analytics' },
      { label: 'Settings', href: '/admin/settings' },
    ],
  },
];

const SANS = 'var(--font-dm-sans), system-ui, sans-serif';
const SERIF = 'var(--font-newsreader), Georgia, serif';

/**
 * On the vladmin subdomain the browser URL may be "/orders" (rewritten to "/admin/orders"),
 * so normalise everything onto the /admin tree before matching.
 */
function normalisePath(raw: string | null): string {
  const path = (raw ?? '/').replace(/\/+$/, '') || '/';
  if (path === '/admin' || path.startsWith('/admin/')) return path;
  return path === '/' ? '/admin' : `/admin${path}`;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  if (href === CATALOG_ROOT) {
    // "Products" covers the catalog list and individual listings, but not the sibling sub-sections.
    if (pathname === CATALOG_ROOT) return true;
    if (!pathname.startsWith(`${CATALOG_ROOT}/`)) return false;
    return !CATALOG_CHILDREN.some((child) => child.href !== CATALOG_ROOT && pathname.startsWith(child.href));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkStyle(active: boolean, hovered: boolean, nested: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: nested ? '7px 16px 7px 28px' : '8px 16px',
    fontFamily: SANS,
    fontSize: nested ? '12.5px' : '13px',
    fontWeight: active ? 500 : 400,
    lineHeight: 1.4,
    textAlign: 'left',
    textDecoration: 'none',
    color: active ? 'var(--admin-sidebar-text-active)' : hovered ? '#D4CFC8' : 'var(--admin-sidebar-text)',
    background: active ? 'var(--admin-sidebar-active-bg)' : hovered ? 'var(--admin-sidebar-hover)' : 'transparent',
    borderLeft: `2px solid ${active ? 'var(--admin-sidebar-accent)' : 'transparent'}`,
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    cursor: 'pointer',
    transition: 'background 150ms ease, color 150ms ease',
  };
}

function SidebarLink({ item, active, nested = false }: { item: NavItem; active: boolean; nested?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      style={linkStyle(active, hovered, nested)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {item.label}
    </Link>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease', opacity: 0.7 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CatalogGroup({ pathname }: { pathname: string }) {
  const inCatalog = pathname === CATALOG_ROOT || pathname.startsWith(`${CATALOG_ROOT}/`);
  const [open, setOpen] = useState(inCatalog);
  const [hovered, setHovered] = useState(false);

  // Auto-expand when navigating into the catalog.
  useEffect(() => {
    if (inCatalog) setOpen(true);
  }, [inCatalog]);

  // The toggle is highlighted (text only) when a catalog page is open but the group is collapsed.
  const toggleStyle = linkStyle(false, hovered, false);
  if (inCatalog) toggleStyle.color = 'var(--admin-sidebar-text-active)';

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={toggleStyle}
      >
        <span>Catalog</span>
        <Chevron open={open} />
      </button>
      {open && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {CATALOG_CHILDREN.map((child) => (
            <li key={child.href}>
              <SidebarLink item={child} active={isActive(pathname, child.href)} nested />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AdminSidebar() {
  const pathname = normalisePath(usePathname());

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'var(--admin-sidebar-width)',
        height: '100vh',
        background: 'var(--admin-sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        zIndex: 40,
      }}
    >
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--admin-sidebar-border)' }}>
        <Link href="/admin" style={{ textDecoration: 'none', display: 'block' }}>
          <span
            style={{
              display: 'block',
              fontFamily: SERIF,
              fontSize: '15px',
              letterSpacing: '0.2em',
              color: '#F5F0E8',
              whiteSpace: 'nowrap',
            }}
          >
            VELLEE LUXE
          </span>
          <span
            style={{
              display: 'block',
              marginTop: '6px',
              fontFamily: SANS,
              fontSize: '9px',
              letterSpacing: '0.16em',
              color: 'var(--admin-sidebar-text)',
            }}
          >
            TIMELESS ELEGANCE
          </span>
        </Link>
      </div>

      <nav aria-label="Admin" style={{ flex: 1, paddingBottom: '16px' }}>
        {NAV.map((group) => (
          <div key={group.title}>
            <p
              style={{
                padding: '16px 16px 6px',
                margin: 0,
                fontFamily: SANS,
                fontSize: '9px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--admin-sidebar-text)',
                opacity: 0.5,
              }}
            >
              {group.title}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {group.items.map((item) =>
                'children' in item ? (
                  <CatalogGroup key={item.label} pathname={pathname} />
                ) : (
                  <li key={item.href}>
                    <SidebarLink item={item} active={isActive(pathname, item.href)} />
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </nav>

      <div
        style={{
          borderTop: '1px solid var(--admin-sidebar-border)',
          padding: '14px 20px 18px',
          fontFamily: SANS,
          fontSize: '9px',
          letterSpacing: '0.14em',
          color: 'var(--admin-sidebar-text)',
          opacity: 0.6,
        }}
      >
        ADMIN PANEL
      </div>
    </aside>
  );
}
