import { Injectable } from '@nestjs/common';
import { Prisma } from '@repo/db';

const ORDER_KEY = 'orders.sequence';
const REFUND_KEY = 'refunds.sequence';
const RETURN_KEY = 'returns.sequence';
const PAD = 6;

// Per-transaction sequential numbering. Uses Settings rows as counters; the bump
// happens inside the caller's transaction so Postgres row locks serialise concurrent
// inserts. Gaps are possible if a tx rolls back — fine for human-friendly numbers.
//
// Sprint 4 used this for orders. Sprint 5 added refunds (RFD-) on a separate counter.
// Sprint 6 adds returns (RTN-) following the same pattern.

export type SequenceKind = 'order' | 'refund' | 'return';

@Injectable()
export class OrderNumberingService {
  /**
   * Atomically advance a counter and return the next number string. Must run inside a
   * Prisma transaction.
   */
  async next(tx: Prisma.TransactionClient, kind: SequenceKind = 'order'): Promise<string> {
    const { key, prefix } = configFor(kind);
    const row = await tx.setting.findUnique({ where: { key } });
    const current = parseInt(
      typeof row?.value === 'number' ? String(row.value) : ((row?.value as string) ?? '0'),
      10,
    );
    const next = (Number.isFinite(current) ? current : 0) + 1;

    if (row) {
      await tx.setting.update({
        where: { key },
        data: { value: next as Prisma.InputJsonValue },
      });
    } else {
      await tx.setting.create({
        data: { key, value: next as Prisma.InputJsonValue },
      });
    }

    return `${prefix}${String(next).padStart(PAD, '0')}`;
  }
}

function configFor(kind: SequenceKind): { key: string; prefix: string } {
  switch (kind) {
    case 'refund':
      return { key: REFUND_KEY, prefix: 'RFD-' };
    case 'return':
      return { key: RETURN_KEY, prefix: 'RTN-' };
    case 'order':
    default:
      return { key: ORDER_KEY, prefix: 'RLD-' };
  }
}
