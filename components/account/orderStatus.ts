import type { BadgeVariant } from '@/components/ui/Badge';
import type { OrderStatus } from '@/lib/types';

/** Customer-facing label and badge colour for each order status. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'sand' },
  confirmed: { label: 'Confirmed', variant: 'oxford' },
  processing: { label: 'Processing', variant: 'outline' },
  shipped: { label: 'Shipped', variant: 'ink' },
  delivered: { label: 'Delivered', variant: 'persimmon' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};

export function orderStatusInfo(status: OrderStatus) {
  return ORDER_STATUS[status] ?? ORDER_STATUS.pending;
}

export function itemCount(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
