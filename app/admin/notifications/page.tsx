/**
 * /admin/notifications — problems the site detected on its own (unreadable supplier
 * sheets, columns Gemini couldn't map, missing stock…). Reads Firestore on every request.
 */
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  clearResolvedNotifications,
  dismissNotification,
  getNotifications,
  type AdminNotification,
  type NotificationType,
} from '@/lib/admin-notifications';

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

const DOT_COLOURS: Record<NotificationType, string> = {
  error: '#C0392B',
  warning: '#D4A017',
  info: '#2F6FB5',
};

const TYPE_LABELS: Record<NotificationType, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

const sectionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '24px',
};

const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6F6A62',
  fontWeight: 600,
  padding: '0 12px 10px',
  borderBottom: '1px solid #e5e5e5',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '1px solid #e5e5e5',
  fontSize: '14px',
  verticalAlign: 'top',
};

const smallButton: React.CSSProperties = {
  background: 'transparent',
  color: '#1C2230',
  border: '1px solid #ccc',
  borderRadius: '6px',
  padding: '7px 12px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function Row({ n }: { n: AdminNotification }) {
  return (
    <tr style={{ opacity: n.resolved ? 0.55 : 1 }}>
      <td style={{ ...td, width: '24px' }}>
        <span
          role="img"
          aria-label={TYPE_LABELS[n.type]}
          title={TYPE_LABELS[n.type]}
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: DOT_COLOURS[n.type],
            marginTop: '5px',
          }}
        />
      </td>
      <td style={{ ...td, fontWeight: 600, minWidth: '160px' }}>
        {n.title}
        {n.resolved ? (
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#1E6B45', marginTop: '4px' }}>Resolved</span>
        ) : null}
      </td>
      <td style={{ ...td, color: '#3A3F4B', lineHeight: 1.5, minWidth: '240px' }}>
        {n.message}
        {n.spreadsheetId ? (
          <span style={{ display: 'block', fontSize: '12px', color: '#6F6A62', marginTop: '4px', wordBreak: 'break-all' }}>
            ID: {n.spreadsheetId}
          </span>
        ) : null}
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{n.supplierName || '—'}</td>
      <td style={{ ...td, whiteSpace: 'nowrap', color: '#6F6A62' }}>
        <time dateTime={n.updatedAt} title={fullTime(n.updatedAt)}>
          {timeAgo(n.updatedAt)}
        </time>
      </td>
      <td style={{ ...td, textAlign: 'right' }}>
        {n.resolved ? null : (
          <form action={dismissAction.bind(null, n.id)}>
            <button type="submit" style={smallButton} aria-label={`Dismiss: ${n.title}`}>
              Dismiss
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}

export default async function AdminNotificationsPage() {
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

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
          margin: '0 0 24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>Notifications</h1>
          {!loadError ? (
            <p style={{ fontSize: '14px', color: '#6F6A62', margin: '6px 0 0' }}>
              {openCount} unresolved · {resolvedCount} resolved
            </p>
          ) : null}
        </div>
        {resolvedCount > 0 ? (
          <form action={clearResolvedAction}>
            <button type="submit" style={{ ...smallButton, padding: '10px 16px', fontSize: '14px' }}>
              Dismiss all resolved ({resolvedCount})
            </button>
          </form>
        ) : null}
      </div>

      {loadError ? (
        <p style={{ ...sectionStyle, borderColor: '#C8623D', color: '#C8623D' }}>{loadError}</p>
      ) : notifications.length === 0 ? (
        <section style={sectionStyle}>
          <p style={{ margin: 0, fontSize: '15px', color: '#1E6B45', fontWeight: 500 }}>
            All systems running — no issues detected.
          </p>
        </section>
      ) : (
        <section style={{ ...sectionStyle, padding: '20px 12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>
                  <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Type
                  </span>
                </th>
                <th style={th}>Title</th>
                <th style={th}>Message</th>
                <th style={th}>Supplier</th>
                <th style={th}>Time</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <Row key={n.id} n={n} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
