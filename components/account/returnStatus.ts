import type { BadgeVariant } from '@/components/ui/Badge';
import { RETURN_STATUS_LABELS, RETURN_TYPE_LABELS } from '@/lib/returns-shared';
import type { ReturnStatus, ReturnType } from '@/lib/types';

/** Customer-facing badge colour for each return status (same palette as order statuses). */
const STATUS_VARIANTS: Record<ReturnStatus, BadgeVariant> = {
  pending_review: 'sand',
  requested: 'oxford',
  pickup_scheduled: 'oxford',
  received: 'outline',
  inspecting: 'ink',
  resolved: 'persimmon',
  rejected: 'muted',
};

const TYPE_VARIANTS: Record<ReturnType, BadgeVariant> = {
  size_exchange: 'outline',
  store_credit: 'muted',
  damage_defect: 'muted',
};

export function returnStatusInfo(status: ReturnStatus): { label: string; variant: BadgeVariant } {
  return { label: RETURN_STATUS_LABELS[status] ?? 'Requested', variant: STATUS_VARIANTS[status] ?? 'sand' };
}

export function returnTypeInfo(type: ReturnType): { label: string; variant: BadgeVariant } {
  return { label: RETURN_TYPE_LABELS[type] ?? 'Request', variant: TYPE_VARIANTS[type] ?? 'muted' };
}
