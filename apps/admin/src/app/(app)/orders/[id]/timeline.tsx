import {
  Check,
  CircleDot,
  Edit3,
  MessageCircle,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import type { OrderEventResponse } from '@repo/types';

interface TimelineProps {
  events: OrderEventResponse[];
}

// Vertical timeline. Most recent at the bottom (chronological). Shows an icon per
// event type so the admin can scan it at a glance.
export function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return <p className="text-[12.5px] text-ink-500">No events yet.</p>;
  }
  return (
    <ol className="relative ml-2 space-y-3 border-l border-ink-100 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[18px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-snow ring-1 ring-ink-200 text-ink-500">
            {iconFor(event.eventType)}
          </span>
          <div className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
            {labelFor(event.eventType)}
          </div>
          {event.message ? (
            <p className="mt-0.5 text-[12.5px] text-ink-900">{event.message}</p>
          ) : null}
          <p className="font-mono text-[10.5px] text-ink-400">
            {new Date(event.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {event.actor}
          </p>
        </li>
      ))}
    </ol>
  );
}

function iconFor(eventType: string) {
  if (eventType.startsWith('state.confirmed') || eventType === 'payment.captured')
    return <CircleDot className="h-3 w-3 text-success" />;
  if (eventType === 'state.packed') return <Package className="h-3 w-3 text-clay" />;
  if (eventType === 'state.shipped' || eventType === 'state.out_for_delivery')
    return <Truck className="h-3 w-3 text-info" />;
  if (eventType === 'state.delivered') return <Check className="h-3 w-3 text-success" />;
  if (eventType === 'state.cancelled' || eventType === 'payment.failed')
    return <XCircle className="h-3 w-3 text-danger" />;
  if (eventType === 'payment.refunded' || eventType === 'refund.requested' || eventType === 'refund.rejected')
    return <RotateCcw className="h-3 w-3 text-warning" />;
  if (eventType === 'note.updated') return <Edit3 className="h-3 w-3 text-ink-500" />;
  if (eventType === 'tracking.assigned') return <Truck className="h-3 w-3 text-info" />;
  return <MessageCircle className="h-3 w-3 text-ink-500" />;
}

function labelFor(eventType: string): string {
  return eventType.replace(/\./g, ' · ').replace(/_/g, ' ');
}
