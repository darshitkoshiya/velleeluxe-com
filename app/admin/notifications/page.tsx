/**
 * /admin/notifications — problems the site detected on its own (unreadable supplier
 * sheets, columns Gemini couldn't map, missing stock…). Reads Firestore on every request.
 */
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  clearResolvedNotifications,
  dismissNotification,
  getNotifications,
  type AdminNotification,
  type NotificationType,
} from '@/lib/admin-notifications';
import PageHeader from '@/components/admin/ui/PageHeader';
import EmptyState from '@/components/admin/ui/EmptyState';
import { ADMIN_FORM_CSS, DANGER, DANGER_BG, MONO, OK, SANS, button, sectionCard } from '@/components/admin/ui/form-styles';

export const dynamic = 'force-dynamic';

/**
 * Server actions can be called by POSTing to any route, so they re-check the same
 * HTTP Basic Auth credentials that middleware.ts enforces for /admin pages.
 */
function isAdminRequest(): boolean {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) return false;
  const authHeader = headers().get('authorization') ?? '';
  if (!authHeader.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator === -1) return false;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  return username === (process.env.ADMIN_USERNAME || 'admin') && password === adminPass;
}

async function dismissAction(id: string) {
  'use server';
  if (!isAdminRequest()) throw new Error('Unauthorized');
  await dismissNotification(id);
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}

/** Marks every unresolved alert as resolved (same effect as Dismiss on each one). */
async function dismissAllAction() {
  'use server';
  if (!isAdminRequest()) throw new Error('Unauthorized');
  const open = (await getNotifications()).filter((n) => !n.resolved);
  await Promise.all(open.map((n) => dismissNotification(n.id)));
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}

async function clearResolvedAction() {
  'use server';
  if (!isAdminRequest()) throw new Error('Unauthorized');
  await clearResolvedNotifications();
  revalidatePath('/admin/notifications');
}

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago". */
function timeAgo(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return `${count} ${name}${count === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

function fullTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

const TYPE_TONES: Record<NotificationType, { fg: string; bg: string; label: string }> = {
  error: { fg: '#9A3B1E', bg: '#F5E1DA', label: 'Error' },
  warning: { fg: '#8A6100', bg: '#FFF4D6', label: 'Warning' },
  info: { fg: '#2F5577', bg: '#E3EDF7', label: 'Info' },
};

type FilterKey = 'all' | 'open' | 'resolved' | 'error' | 'warning';

const FILTERS: { key: FilterKey; label: string; match: (n: AdminNotification) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'open', label: 'Unresolved', match: (n) => !n.resolved },
  { key: 'resolved', label: 'Resolved', match: (n) => n.resolved },
  { key: 'error', label: 'Errors', match: (n) => n.type === 'error' },
  { key: 'warning', label: 'Warnings', match: (n) => n.type === 'warning' },
];

function TypeIcon({ type }: { type: NotificationType }) {
  const tone = TYPE_TONES[type];
  const glyph = type === 'error' ? '!' : type === 'warning' ? '▲' : 'i';
  return (
    <span
      role="img"
      aria-label={tone.label}
      title={tone.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        flexShrink: 0,
        background: tone.bg,
        color: tone.fg,
        fontFamily: SANS,
        fontSize: type === 'warning' ? '10px' : '13px',
        fontWeight: 700,
      }}
    >
      {glyph}
    </span>
  );
}

function NotificationItem({ n, first }: { n: AdminNotification; first: boolean }) {
  return (
    <li
      className="vl-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        padding: '16px 20px',
        borderTop: first ? 'none' : '1px solid var(--admin-border-light)',
        opacity: n.resolved ? 0.6 : 1,
      }}
    >
      <TypeIcon type={n.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--admin-text)' }}>{n.title}</span>
          {n.resolved ? (
            <span style={{ fontSize: '11px', fontWeight: 500, color: OK, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Resolved
            </span>
          ) : null}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '13px', lineHeight: 1.5, color: 'var(--admin-text-muted)' }}>{n.message}</p>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '6px', fontSize: '12px', color: 'var(--admin-text-subtle)' }}>
          {n.supplierName ? <span>Supplier: {n.supplierName}</span> : null}
          {n.spreadsheetId ? <span style={{ fontFamily: MONO, wordBreak: 'break-all' }}>ID: {n.spreadsheetId}</span> : null}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
        <time dateTime={n.updatedAt} title={fullTime(n.updatedAt)} style={{ fontSize: '12px', color: 'var(--admin-text-subtle)', whiteSpace: 'nowrap' }}>
          {timeAgo(n.updatedAt)}
        </time>
        {n.resolved ? null : (
          <form action={dismissAction.bind(null, n.id)}>
            <button type="submit" style={button('ghost', false, 'sm')} aria-label={`Mark resolved: ${n.title}`}>
              Mark resolved
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

export default async function AdminNotificationsPage({ searchParams }: { searchParams?: { filter?: string } }) {
  let notifications: AdminNotification[] = [];
  let loadError: string | null = null;
  try {
    notifications = await getNotifications();
  } catch (error) {
    console.error('[admin] Failed to load notifications:', error);
    loadError = 'Could not load notifications from the database. Check the Firebase Admin settings in your environment variables.';
  }

  const openCount = notifications.filter((n) => !n.resolved).length;
  const resolvedCount = notifications.length - openCount;

  const activeFilter = FILTERS.find((f) => f.key === searchParams?.filter) ?? FILTERS[0];
  const visible = notifications.filter(activeFilter.match);

  return (
    <div style={{ maxWidth: '960px', fontFamily: SANS }}>
      <style>{ADMIN_FORM_CSS}</style>
      <PageHeader
        title="Notifications"
        subtitle={loadError ? 'System alerts and sync problems' : `${openCount} unresolved · ${resolvedCount} resolved`}
        actions={
          loadError ? null : (
            <>
              {resolvedCount > 0 ? (
                <form action={clearResolvedAction}>
                  <button type="submit" style={button('ghost')}>
                    Clear resolved ({resolvedCount})
                  </button>
                </form>
              ) : null}
              {openCount > 0 ? (
                <form action={dismissAllAction}>
                  <button type="submit" style={button('primary')}>
                    Mark all resolved
                  </button>
                </form>
              ) : null}
            </>
          )
        }
      />

      {loadError ? (
        <div role="alert" style={{ ...sectionCard, borderColor: '#E8C9BE', background: DANGER_BG, color: DANGER, fontSize: '13px' }}>
          {loadError}
        </div>
      ) : (
        <>
          <nav aria-label="Filter notifications" style={{ display: 'flex', gap: '0', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid var(--admin-border)' }}>
            {FILTERS.map((f) => {
              const active = f.key === activeFilter.key;
              const count = notifications.filter(f.match).length;
              return (
                <Link
                  key={f.key}
                  href={f.key === 'all' ? '/admin/notifications' : `/admin/notifications?filter=${f.key}`}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    padding: '10px 14px',
                    marginBottom: '-1px',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--admin-text)' : 'var(--admin-text-muted)',
                    textDecoration: 'none',
                    borderBottom: `2px solid ${active ? '#0F1623' : 'transparent'}`,
                  }}
                >
                  {f.label}
                  <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--admin-text-subtle)' }}>{count}</span>
                </Link>
              );
            })}
          </nav>

          <section style={{ ...sectionCard, padding: 0 }}>
            {notifications.length === 0 ? (
              <EmptyState title="All systems running" description="No issues detected. Sync and stock problems will appear here." />
            ) : visible.length === 0 ? (
              <EmptyState title="Nothing here" description={`No ${activeFilter.label.toLowerCase()} notifications.`} />
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {visible.map((n, index) => (
                  <NotificationItem key={n.id} n={n} first={index === 0} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
