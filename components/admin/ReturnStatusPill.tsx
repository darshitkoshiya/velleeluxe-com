import { RETURN_STATUS_LABELS } from '@/lib/returns-shared';
import type { ReturnStatus } from '@/lib/types';

/** Same pill palette as the admin orders table. */
const RETURN_STATUS_COLOURS: Record<ReturnStatus, { bg: string; fg: string }> = {
  pending_review: { bg: '#FFF4D6', fg: '#8A6100' },
  rejected: { bg: '#EEEEEE', fg: '#555555' },
  requested: { bg: '#E0F2E9', fg: '#1E6B45' },
  pickup_scheduled: { bg: '#E3EDF7', fg: '#2F5577' },
  received: { bg: '#EDE7F6', fg: '#553C8B' },
  inspecting: { bg: '#F5E1DA', fg: '#9A3B1E' },
  resolved: { bg: '#D6EFD8', fg: '#185C24' },
};

export function ReturnStatusPill({ status }: { status: ReturnStatus }) {
  const colours = RETURN_STATUS_COLOURS[status] ?? { bg: '#eee', fg: '#333' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background: colours.bg,
        color: colours.fg,
      }}
    >
      {RETURN_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default ReturnStatusPill;
