import Image from 'next/image';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import type { Order, OrderStatus } from '@/lib/types';
import { formatDate, formatPrice } from '@/lib/utils';

const STATUS: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Awaiting payment', variant: 'sand' },
  confirmed: { label: 'Confirmed', variant: 'oxford' },
  processing: { label: 'Processing', variant: 'outline' },
  shipped: { label: 'Shipped', variant: 'ink' },
  delivered: { label: 'Delivered', variant: 'persimmon' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};

export function OrderCard({ order }: { order: Order }) {
  const status = STATUS[order.status] ?? STATUS.pending;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <article className="border border-sand">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sand bg-sand/30 px-5 py-4">
        <div>
          <p className="font-sans text-sm font-medium text-ink">{order.orderId}</p>
          <p className="mt-0.5 font-sans text-xs text-slateGrey">
            <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time> &middot; {itemCount}{' '}
            {itemCount === 1 ? 'item' : 'items'} &middot; {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid online'}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </header>

      <ul className="divide-y divide-sand px-5">
        {order.items.map((item) => (
          <li key={`${item.productId}-${item.size}`} className="flex items-center gap-4 py-4">
            <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-sand">
              {item.image ? <Image src={item.image} alt={item.productName} fill sizes="48px" className="object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-sm text-ink">{item.productName}</p>
              <p className="font-sans text-xs text-slateGrey">
                Size {item.size} &middot; Qty {item.quantity}
              </p>
            </div>
            <p className="font-sans text-sm text-ink">{formatPrice(item.price * item.quantity)}</p>
          </li>
        ))}
      </ul>

      <footer className="flex items-center justify-between border-t border-sand px-5 py-4">
        <span className="font-sans text-xs font-medium uppercase tracking-[0.14em] text-slateGrey">Total</span>
        <span className="font-sans text-base font-medium text-ink">{formatPrice(order.total)}</span>
      </footer>
    </article>
  );
}

export default OrderCard;
